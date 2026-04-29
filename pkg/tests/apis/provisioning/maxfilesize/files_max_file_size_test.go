package maxfilesize

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MaxFileSize_RawRead exercises the read-side
// enforcement of [provisioning] max_file_size on raw files (e.g. README.md).
// A file under the configured cap is served as-is; a file over the cap is
// rejected with HTTP 413 Request Entity Too Large.
func TestIntegrationProvisioning_MaxFileSize_RawRead(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "max-file-size-raw-read"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		LocalPath:              helper.ProvisioningPath,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	smallReadme := []byte("# small README\n")
	largeReadme := bytes.Repeat([]byte("X"), int(testMaxFileSize)+1)

	helper.WriteToProvisioningPath(t, "README.md", smallReadme)
	helper.WriteToProvisioningPath(t, "huge/README.md", largeReadme)

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()

	t.Run("GET small raw file under limit succeeds", func(t *testing.T) {
		url := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/README.md", addr, repo)
		req, err := http.NewRequest(http.MethodGet, url, nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode, "small README should be served")
	})

	t.Run("GET raw file over limit returns 413", func(t *testing.T) {
		url := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/huge/README.md", addr, repo)
		req, err := http.NewRequest(http.MethodGet, url, nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()

		require.Equal(t, http.StatusRequestEntityTooLarge, resp.StatusCode, "oversized README should be rejected with 413")

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Contains(t, string(body), "max allowed", "error body should advertise the cap")
	})
}

// TestIntegrationProvisioning_MaxFileSize_Write exercises the write-side
// enforcement: a POST whose body exceeds [provisioning] max_file_size is
// rejected before the resource is parsed or persisted.
func TestIntegrationProvisioning_MaxFileSize_Write(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "max-file-size-write"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		LocalPath:              helper.ProvisioningPath,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	// A minimal but well-formed dashboard JSON, padded to exceed the cap.
	// Padding lives inside the title field so the body is still valid JSON.
	pad := strings.Repeat("p", int(testMaxFileSize)+1)
	oversized, err := json.Marshal(map[string]any{
		"apiVersion": "dashboard.grafana.app/v1beta1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": "huge"},
		"spec":       map[string]any{"title": pad},
	})
	require.NoError(t, err)
	require.Greater(t, len(oversized), int(testMaxFileSize), "fixture must exceed the configured cap")

	var statusCode int
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "huge.json").
		Body(oversized).
		SetHeader("Content-Type", "application/json").
		Do(ctx).StatusCode(&statusCode)

	require.Error(t, result.Error(), "oversized POST should be rejected")
	require.Contains(t, result.Error().Error(), "request body too large",
		"error should advertise the size cap; got %v", result.Error())
}

// TestIntegrationProvisioning_MaxFileSize_Disabled covers the
// "0 = unlimited" semantics by spinning up a second server with the cap off
// and confirming that a payload that would have been blocked by the shared
// 4 KB cap is accepted.
func TestIntegrationProvisioning_MaxFileSize_Disabled(t *testing.T) {
	helper := common.RunGrafana(t,
		common.WithoutProvisioningFolderMetadata,
		common.WithProvisioningMaxFileSize(0),
	)

	const repo = "max-file-size-disabled"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		LocalPath:              helper.ProvisioningPath,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		SkipResourceAssertions: true,
	})

	// Write a README larger than the shared cap and confirm it round-trips.
	bigReadme := bytes.Repeat([]byte("Y"), 8*1024)
	helper.WriteToProvisioningPath(t, "README.md", bigReadme)

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	url := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/README.md", addr, repo)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	// nolint:errcheck
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode, "with cap disabled, large README should be served")
}

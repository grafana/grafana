package maxbytes

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// incompressibleBytes returns n bytes of random data. Random data does not
// compress, so the git-upload-pack response carrying it stays larger than the
// cap on the wire — this is what makes nanogit's SingleObjectFetchMaxBytes
// abort the read, rather than the response shrinking below the cap and only the
// post-read content check firing.
func incompressibleBytes(t *testing.T, n int) []byte {
	t.Helper()
	b := make([]byte, n)
	_, err := cryptorand.Read(b)
	require.NoError(t, err)
	return b
}

// pushFile commits and pushes a single file to the remote's default branch via
// the local clone returned by CreateGitRepo.
func pushFile(t *testing.T, local interface {
	CreateFile(path, content string) error
	Git(args ...string) (string, error)
}, path string, content []byte, message string) {
	t.Helper()
	require.NoError(t, local.CreateFile(path, string(content)))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", message)
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)
}

// TestIntegrationGitMaxBytes_RawRead exercises nanogit's single-object read
// limit on the git repository path: reading a file over the configured cap
// through the files API fails with HTTP 413 because nanogit aborts the blob
// fetch mid-read; a file under the cap is served as-is.
func TestIntegrationGitMaxBytes_RawRead(t *testing.T) {
	helper := sharedGitHelper(t)

	const repo = "git-max-bytes-raw-read"
	smallContent := []byte("small file under the limit\n")
	_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
		"small.txt": smallContent,
	}, "write")

	// Push the oversized file after the repo is healthy so it never interferes
	// with the connectivity/health check at creation time.
	oversized := incompressibleBytes(t, int(testMaxFileSize)*16)
	pushFile(t, local, "huge.bin", oversized, "add oversized file")

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	rawURL := func(path string) string {
		return fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s", addr, repo, path)
	}

	t.Run("GET small file under limit succeeds", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, rawURL("small.txt"), nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode, "under-limit file should be served")

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var wrapper struct {
			Resource struct {
				File struct {
					Content string `json:"content"`
				} `json:"file"`
			} `json:"resource"`
		}
		require.NoError(t, json.Unmarshal(body, &wrapper))
		require.Equal(t, string(smallContent), wrapper.Resource.File.Content,
			"under-limit raw file should be served verbatim")
	})

	t.Run("GET file over limit returns 413", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, rawURL("huge.bin"), nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()

		require.Equal(t, http.StatusRequestEntityTooLarge, resp.StatusCode,
			"oversized file read over git should be rejected with 413")
	})
}

// TestIntegrationGitMaxBytes_Pull exercises the limit on the sync path: a pull
// over a git repository containing a file larger than the cap completes with
// state=error and records a per-file error for the oversized file, while
// under-cap resources in the same repository are still applied.
func TestIntegrationGitMaxBytes_Pull(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repo = "git-max-bytes-pull"

	smallDashboard := common.DashboardJSON("small-dash", "Small Dashboard", 1)
	require.Less(t, len(smallDashboard), int(testMaxFileSize),
		"fixture must fit under the configured cap")

	// A valid dashboard JSON padded past the cap with incompressible data so
	// the blob fetch trips the wire-level limit during sync.
	pad := hex.EncodeToString(incompressibleBytes(t, int(testMaxFileSize)*16))
	oversized, err := json.Marshal(map[string]any{
		"uid":           "huge-dash",
		"title":         pad,
		"tags":          []string{},
		"timezone":      "browser",
		"schemaVersion": 39,
		"version":       1,
		"refresh":       "",
		"panels":        []any{},
	})
	require.NoError(t, err)
	require.Greater(t, len(oversized), int(testMaxFileSize),
		"fixture must exceed the configured cap")

	helper.CreateGitRepo(t, repo, map[string][]byte{
		"small.json": smallDashboard,
		"huge.json":  oversized,
	}, "write")

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
		"pull should end in error state when a file exceeds the cap; job: %+v", jobObj.Status)
	require.NotEmpty(t, jobObj.Status.Errors,
		"pull should record a per-file error for the oversized file")

	var foundOversized bool
	for _, e := range jobObj.Status.Errors {
		if strings.Contains(e, "huge.json") {
			foundOversized = true
			break
		}
	}
	require.True(t, foundOversized,
		"expected an error mentioning huge.json; errors=%v", jobObj.Status.Errors)

	// Under-cap resources in the same repository are still applied — the cap is
	// enforced per file, not per sync.
	common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
}

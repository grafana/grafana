package maxfilesize

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MaxFileSize_Write exercises the write-side
// enforcement: a POST whose body exceeds [provisioning] max_file_size is
// rejected before the resource is parsed or persisted.
func TestIntegrationProvisioning_MaxFileSize_Write(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "max-file-size-write"
	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo,
		Path:                   helper.ProvisioningPath,
		Target:                 "instance",
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
	require.Equal(t, http.StatusRequestEntityTooLarge, statusCode,
		"oversized POST should return HTTP 413; got %v", result.Error())
	require.Contains(t, result.Error().Error(), "request body too large",
		"error should advertise the size cap; got %v", result.Error())
}

// TestIntegrationProvisioning_MaxFileSize_Pull exercises the sync-side
// enforcement: a pull job over a repository that contains a file larger than
// [provisioning] max_file_size completes with state=error, recording a
// per-file error for the oversized file. Under-cap files in the same
// repository are still applied successfully.
func TestIntegrationProvisioning_MaxFileSize_Pull(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "max-file-size-pull"
	helper.CreateRepo(t, common.TestRepo{
		Name:                   repo,
		Path:                   helper.ProvisioningPath,
		Target:                 "instance",
		SkipResourceAssertions: true,
	})

	smallDashboard := common.DashboardJSON("small-dash", "Small Dashboard", 1)
	require.Less(t, len(smallDashboard), int(testMaxFileSize),
		"fixture must fit under the configured cap")

	// Pad an otherwise valid dashboard JSON so the bytes-on-disk exceed the cap.
	pad := strings.Repeat("p", int(testMaxFileSize)+1)
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

	helper.WriteToProvisioningPath(t, "small.json", smallDashboard)
	helper.WriteToProvisioningPath(t, "huge.json", oversized)

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
		"pull should end in error state when a file exceeds max_file_size; job: %+v", jobObj.Status)
	require.NotEmpty(t, jobObj.Status.Errors,
		"pull should record a per-file error for the oversized file")

	var foundOversized bool
	for _, e := range jobObj.Status.Errors {
		if strings.Contains(e, "huge.json") && strings.Contains(e, "max allowed") {
			foundOversized = true
			break
		}
	}
	require.True(t, foundOversized,
		"expected an error mentioning huge.json and the size cap; errors=%v", jobObj.Status.Errors)

	// Under-cap files in the same repository are still applied — the cap is
	// enforced per file, not per sync.
	helper.RequireRepoDashboardCount(t, repo, 1)
}

// The "0 = unlimited" semantics are covered by the unit test
// TestHandleGetRawFile_MaxFileSize/zero_disables_limit. We deliberately do
// not exercise it as a separate integration test here: spinning up a second
// Grafana inside this package would share the package-wide test database
// with the shared env, and the shared env's controllers would then attempt
// to validate the second server's repos against their own (different)
// permitted_provisioning_paths and fail the sync.

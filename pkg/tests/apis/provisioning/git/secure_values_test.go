package git

import (
	"encoding/json"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
)

// plaintextSecret is the payload the guard must keep out of git -- and out of
// the error it reports.
const plaintextSecret = "do-not-commit-me"

// dashboardWithSecureValue builds a dashboard file carrying an inline secure
// value. dashboard.grafana.app/v1 is written with FieldValidation=Ignore, so the
// apiserver drops the extra top-level field once provisioning lets it through.
func dashboardWithSecureValue(t *testing.T, name string, secure map[string]any) []byte {
	t.Helper()
	data, err := json.MarshalIndent(map[string]any{
		"apiVersion": "dashboard.grafana.app/v1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": name},
		"spec":       map[string]any{"title": name},
		"secure":     secure,
	}, "", "\t")
	require.NoError(t, err)
	return data
}

func TestIntegrationGitFiles_CreateSecureValueRejected(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "secure-value-create-rejected"
	_, _ = helper.CreateGitRepo(t, repoName, nil, "write")

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "dashboard.json").
		Param("message", "Create a dashboard with a secret").
		Body(dashboardWithSecureValue(t, "secure-create-dash", map[string]any{
			"apiKey": map[string]any{"create": plaintextSecret},
		})).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	require.Error(t, result.Error(), "creating a file with a plaintext secure value should be rejected")
	require.True(t, apierrors.IsBadRequest(result.Error()),
		"error should be a BadRequest (validation error), got: %v", result.Error())
	require.Contains(t, result.Error().Error(), "secure values (apiKey) cannot be created or removed from a git repository")
	require.NotContains(t, result.Error().Error(), plaintextSecret, "the error must not echo the secret")

	helper.RequireRepoFileNotFound(t, repoName, "dashboard.json")
}

func TestIntegrationGitFiles_CreateSecureValueReferenceAllowed(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "secure-value-reference-allowed"
	_, _ = helper.CreateGitRepo(t, repoName, nil, "write")

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "dashboard.json").
		Param("message", "Create a dashboard referencing a secure value").
		Body(dashboardWithSecureValue(t, "secure-ref-dash", map[string]any{
			"apiKey": map[string]any{"name": "an-existing-secure-value"},
		})).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	require.NoError(t, result.Error(), "a reference to an existing secure value should be allowed")
	helper.RequireRepoFileExists(t, repoName, "dashboard.json")
}

func TestIntegrationGitFiles_RemoveSecureValueRejected(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "secure-value-remove-rejected"
	_, _ = helper.CreateGitRepo(t, repoName, nil, "write")

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "dashboard.json").
		Param("message", "Remove a secure value").
		Body(dashboardWithSecureValue(t, "secure-remove-dash", map[string]any{
			"apiKey": map[string]any{"remove": true},
		})).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	require.Error(t, result.Error(), "a file must not delete a secure value it never owned")
	require.True(t, apierrors.IsBadRequest(result.Error()),
		"error should be a BadRequest (validation error), got: %v", result.Error())
	require.Contains(t, result.Error().Error(), "secure values (apiKey) cannot be created or removed from a git repository")

	helper.RequireRepoFileNotFound(t, repoName, "dashboard.json")
}

func TestIntegrationProvisioning_FullSync_SecureValueIsWarning(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "secure-value-sync-warning"
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("plain-sync-dash", "Dashboard", 1),
		"secret.json": dashboardWithSecureValue(t, "secure-sync-dash", map[string]any{
			"apiKey": map[string]any{"create": plaintextSecret},
		}),
	})

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors, "a rejected secure value should warn, not fail the sync")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
	common.RequireJobWarningContains(t, jobObj, "secure values (apiKey) cannot be created or removed from a git repository")

	helper.RequireRepoDashboardCount(t, repoName, 1)
}

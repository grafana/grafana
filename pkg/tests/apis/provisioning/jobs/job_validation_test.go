package jobs

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_JobValidation(t *testing.T) {
	helper := sharedHelper(t)

	// Create a test repository first
	const repo = "job-validation-test-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{},
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.RequireRepoDashboardCount(t, repo, 0)
	helper.RequireRepoFolderCount(t, repo, 1)

	// Build a resource list that exceeds the selective-export cap (100).
	overLimitResources := make([]map[string]interface{}, 101)
	for i := range overLimitResources {
		overLimitResources[i] = map[string]interface{}{
			"name": fmt.Sprintf("dash-%d", i),
			"kind": "Dashboard",
		}
	}

	tests := []struct {
		name        string
		jobSpec     map[string]interface{}
		expectedErr string
	}{
		{
			name: "job without action",
			jobSpec: map[string]interface{}{
				"repository": repo,
			},
			expectedErr: "spec.action: Required value: action must be specified",
		},
		{
			name: "job with invalid action",
			jobSpec: map[string]interface{}{
				"action":     "invalid-action",
				"repository": repo,
			},
			expectedErr: "spec.action: Invalid value: \"invalid-action\": invalid action",
		},
		{
			name: "pull job without pull options",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPull),
				"repository": repo,
			},
			expectedErr: "spec.pull: Required value: pull options required for pull action",
		},
		{
			name: "push job without push options",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
			},
			expectedErr: "spec.push: Required value: push options required for push action",
		},
		{
			name: "push job with invalid branch name",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"branch":  "feature..branch", // Invalid: consecutive dots
					"message": "Test commit",
				},
			},
			expectedErr: "spec.push.branch: Invalid value: \"feature..branch\": invalid git branch name",
		},
		{
			name: "push job with path traversal",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"path":    "../../etc/passwd", // Invalid: path traversal
					"message": "Test commit",
				},
			},
			expectedErr: "spec.push.path: Invalid value: \"../../etc/passwd\"",
		},
		{
			name: "delete job without paths or resources",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionDelete),
				"repository": repo,
				"delete":     map[string]interface{}{},
			},
			expectedErr: "spec.delete: Required value: at least one path or resource must be specified",
		},
		{
			name: "delete job with invalid path",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionDelete),
				"repository": repo,
				"delete": map[string]interface{}{
					"paths": []string{"../invalid/path"},
				},
			},
			expectedErr: "spec.delete.paths[0]: Invalid value: \"../invalid/path\"",
		},
		{
			name: "move job without target path",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionMove),
				"repository": repo,
				"move": map[string]interface{}{
					"paths": []string{"dashboard.json"},
				},
			},
			expectedErr: "spec.move.targetPath: Required value: target path is required",
		},
		{
			name: "move job without paths or resources",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionMove),
				"repository": repo,
				"move": map[string]interface{}{
					"targetPath": "new-location/",
				},
			},
			expectedErr: "spec.move: Required value: at least one path or resource must be specified",
		},
		{
			name: "move job with invalid target path",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionMove),
				"repository": repo,
				"move": map[string]interface{}{
					"paths":      []string{"dashboard.json"},
					"targetPath": "../../../etc/", // Invalid: path traversal
				},
			},
			expectedErr: "spec.move.targetPath: Invalid value: \"../../../etc/\"",
		},
		{
			name: "migrate job without migrate options",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionMigrate),
				"repository": repo,
			},
			expectedErr: "spec.migrate: Required value: migrate options required for migrate action",
		},
		{
			// Playlist is declared but disabled in the default config, so it is not part of
			// the active supported set and must be rejected for export.
			name: "push job with disabled resource kind",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "playlist-1", "kind": "Playlist"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].kind: Invalid value: \"Playlist\": kind is not supported for export",
		},
		{
			name: "push job with wrong group for supported kind",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "dash-1", "kind": "Dashboard", "group": "folder.grafana.app"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].group: Invalid value: \"folder.grafana.app\": group \"folder.grafana.app\" is not supported for kind Dashboard",
		},
		{
			name: "push job with resource missing name",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"kind": "Dashboard"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].name: Required value: resource name is required",
		},
		{
			name: "push job with resource missing kind",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "dash-1"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].kind: Required value: resource kind is required",
		},
		{
			name: "push job with empty resource ref",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{},
					},
				},
			},
			expectedErr: "spec.push.resources[0].name: Required value",
		},
		{
			name: "push job reports index of bad resource in a mixed list",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "dash-1", "kind": "Dashboard"},
						{"name": "playlist-1", "kind": "Playlist"},
					},
				},
			},
			expectedErr: "spec.push.resources[1].kind: Invalid value: \"Playlist\": kind is not supported for export",
		},
		{
			// Kind matching is case-sensitive: "dashboard" does not match the supported "Dashboard".
			name: "push job with lowercase dashboard kind",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "dash-1", "kind": "dashboard"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].kind: Invalid value: \"dashboard\": kind is not supported for export",
		},
		{
			// LibraryPanel is declared but disabled in the default config.
			name: "push job with LibraryPanel kind",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "panel-1", "kind": "LibraryPanel"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].kind: Invalid value: \"LibraryPanel\": kind is not supported for export",
		},
		{
			name: "push job exceeding the selective export resource limit",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": overLimitResources,
				},
			},
			expectedErr: "spec.push.resources: Too many: 101: must have at most 100 items",
		},
		{
			name: "migrate job exceeding the selective export resource limit",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionMigrate),
				"repository": repo,
				"migrate": map[string]interface{}{
					"resources": overLimitResources,
				},
			},
			expectedErr: "spec.migrate.resources: Too many: 101: must have at most 100 items",
		},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create the job object directly
			jobObj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "provisioning.grafana.app/v0alpha1",
					"kind":       "Job",
					"metadata": map[string]interface{}{
						"name":      fmt.Sprintf("test-job-validation-%d", i),
						"namespace": "default",
					},
					"spec": tt.jobSpec,
				},
			}

			// Try to create the job - should fail with validation error
			_, err := helper.Jobs.Resource.Create(t.Context(), jobObj, metav1.CreateOptions{})
			require.Error(t, err, "expected validation error for invalid job spec")

			// Verify it's a validation error with correct status code
			statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
			require.Contains(t, statusError.Message, tt.expectedErr, "error message should contain expected validation message")
		})
	}
}

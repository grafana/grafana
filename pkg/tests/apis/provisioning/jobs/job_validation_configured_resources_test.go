package jobs

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// TestIntegrationProvisioning_JobValidationConfiguredResources verifies that the job admission
// validator honors the configured supported-resource set ([provisioning] resources) rather than a
// hardcoded dashboard-only rule: a kind added purely through configuration is accepted for export,
// while kinds outside the active set (unknown or declared-but-disabled) are rejected. This mirrors
// the config-driven settings test added alongside the supported-resource set.
func TestIntegrationProvisioning_JobValidationConfiguredResources(t *testing.T) {
	helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
		// example.grafana.app/Example is added purely through config (it need not be served:
		// admission validates the configured descriptor without discovery). playlist is declared
		// but disabled, so it must not be accepted for export.
		opts.ProvisioningResources = []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard:folder",
			"example.grafana.app/Example",
			"playlist.grafana.app/Playlist:disabled",
		}
	})
	ctx := context.Background()

	// The job admission validator only requires a non-empty repository name; it does not check
	// repository existence (that happens later, in the jobs connector / worker). Creating Job
	// objects directly through the resource client exercises admission in isolation, so no real
	// repository is needed.
	const repo = "job-validation-configured-resources"

	tests := []struct {
		name         string
		jobSpec      map[string]interface{}
		wantAccepted bool
		expectedErr  string
	}{
		{
			name: "push job with config-added kind is accepted",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "ex-1", "kind": "Example", "group": "example.grafana.app"},
					},
				},
			},
			wantAccepted: true,
		},
		{
			name: "push job with config-added kind and no group is accepted",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "ex-1", "kind": "Example"},
					},
				},
			},
			wantAccepted: true,
		},
		{
			name: "migrate job with config-added kind is accepted",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionMigrate),
				"repository": repo,
				"migrate": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "ex-1", "kind": "Example", "group": "example.grafana.app"},
					},
				},
			},
			wantAccepted: true,
		},
		{
			name: "push job with disabled configured kind is rejected",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "pl-1", "kind": "Playlist"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].kind: Invalid value: \"Playlist\": kind is not supported for export",
		},
		{
			name: "push job with unconfigured kind is rejected",
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
			name: "push job with wrong group for config-added kind is rejected",
			jobSpec: map[string]interface{}{
				"action":     string(provisioning.JobActionPush),
				"repository": repo,
				"push": map[string]interface{}{
					"resources": []map[string]interface{}{
						{"name": "ex-1", "kind": "Example", "group": "wrong.grafana.app"},
					},
				},
			},
			expectedErr: "spec.push.resources[0].group: Invalid value: \"wrong.grafana.app\": group \"wrong.grafana.app\" is not supported for kind Example",
		},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := fmt.Sprintf("test-job-configured-%d", i)
			jobObj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "provisioning.grafana.app/v0alpha1",
					"kind":       "Job",
					"metadata": map[string]interface{}{
						"name":      name,
						"namespace": "default",
					},
					"spec": tt.jobSpec,
				},
			}

			_, err := helper.Jobs.Resource.Create(ctx, jobObj, metav1.CreateOptions{})
			if tt.wantAccepted {
				require.NoError(t, err, "job referencing a configured kind should pass admission")
				// Best-effort cleanup: the job controller reconciles the new job concurrently, so a
				// delete can race with a status update. Admission acceptance is the assertion here.
				_ = helper.Jobs.Resource.Delete(ctx, name, metav1.DeleteOptions{})
				return
			}

			require.Error(t, err, "job referencing an unsupported kind should be rejected")
			statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
			require.Contains(t, statusError.Message, tt.expectedErr, "error message should contain expected validation message")
		})
	}
}

package collections

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

// The collection group is what the index reports a stored member under, so it is what the
// frontend matches stats and list rows against.
func TestIntegrationProvisioning_SettingsReportsTheCollection(t *testing.T) {
	helper := sharedHelper(t)

	settings := &provisioning.RepositoryViewList{}
	result := helper.AdminREST.Get().
		Namespace("default").
		Resource("settings").
		Do(t.Context())

	require.NoError(t, result.Error(), "should be able to GET settings")
	require.NoError(t, result.Into(settings), "should be able to unmarshal settings response")

	require.Contains(t, settings.AvailableResources, provisioning.SupportedResource{
		Group: datasourceCollection, Kind: "DataSource",
	}, "a wildcard entry is reported as the collection it names")
	require.Contains(t, settings.AvailableResources, provisioning.SupportedResource{
		Group: extCollection, Kind: "Thing",
	}, "a plugin-served collection is reported the same way")
	require.Contains(t, settings.AvailableResources, provisioning.SupportedResource{
		Group: settingsCollection, Kind: "Settings",
	}, "a pattern that names its collection is reported as that collection")

	for _, r := range settings.AvailableResources {
		require.NotContains(t, r.Group, "*", "the wildcard token itself is never surfaced")
		require.NotContains(t, r.Group, "@", "nor the collection qualifier")
	}
}

// A collection's members each serve their own group, so a job cannot resolve the group from the
// kind alone the way it can for a kind that serves exactly one.
func TestIntegrationProvisioning_JobValidationCollectionGroup(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "collection-job-validation"

	tests := []struct {
		name         string
		resource     map[string]interface{}
		wantAccepted bool
		expectedErr  string
	}{
		{
			name:         "a member of the collection is accepted",
			resource:     map[string]interface{}{"name": "ds-1", "kind": "DataSource", "group": "prometheus." + datasourceCollection},
			wantAccepted: true,
		},
		{
			name:         "a plugin-served member is accepted",
			resource:     map[string]interface{}{"name": "thing-1", "kind": "Thing", "group": "router-test." + extCollection},
			wantAccepted: true,
		},
		{
			name:         "a member of a pattern that names its collection is accepted",
			resource:     map[string]interface{}{"name": "instance", "kind": "Settings", "group": "grafana-slo-app"},
			wantAccepted: true,
		},
		{
			name:        "an omitted group is rejected",
			resource:    map[string]interface{}{"name": "ds-1", "kind": "DataSource"},
			expectedErr: "spec.push.resources[0].group: Required value: group is required for kind DataSource: it is served by several groups",
		},
		{
			name:        "the collection group itself is rejected",
			resource:    map[string]interface{}{"name": "ds-1", "kind": "DataSource", "group": datasourceCollection},
			expectedErr: fmt.Sprintf("spec.push.resources[0].group: Invalid value: %q: group %q is not supported for kind DataSource", datasourceCollection, datasourceCollection),
		},
		{
			name:        "a group outside the collection is rejected",
			resource:    map[string]interface{}{"name": "ds-1", "kind": "DataSource", "group": "playlist.grafana.app"},
			expectedErr: "spec.push.resources[0].group: Invalid value: \"playlist.grafana.app\": group \"playlist.grafana.app\" is not supported for kind DataSource",
		},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := fmt.Sprintf("collection-job-%d", i)
			jobObj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "provisioning.grafana.app/v0alpha1",
					"kind":       "Job",
					"metadata": map[string]interface{}{
						"name":      name,
						"namespace": "default",
					},
					"spec": map[string]interface{}{
						"action":     string(provisioning.JobActionPush),
						"repository": repo,
						"push": map[string]interface{}{
							"resources": []map[string]interface{}{tt.resource},
						},
					},
				},
			}

			_, err := helper.Jobs.Resource.Create(t.Context(), jobObj, metav1.CreateOptions{})
			if tt.wantAccepted {
				require.NoError(t, err, "job naming a member of the collection should pass admission")
				// Best-effort: the delete races the controller's status update.
				_ = helper.Jobs.Resource.Delete(t.Context(), name, metav1.DeleteOptions{})
				return
			}

			require.Error(t, err, "job should be rejected")
			statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
			require.Contains(t, statusError.Message, tt.expectedErr)
		})
	}
}

// Expansion asks discovery once and every consumer of a client shares that result, so a collection
// resolving to no members must come back empty rather than fail the kinds that do serve a group.
func TestIntegrationProvisioning_CollectionWithoutServedMembersSyncs(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "collection-unserved"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Copies: map[string]string{
			"../testdata/all-panels.json": "all-panels.json",
		},
	})

	require.Len(t, helper.ListRepoDashboards(t, repo), 1, "the dashboard should have synced")
}

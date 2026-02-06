package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationSnapshotDualWrite(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		name        string
		dualWrite   grafanarest.DualWriterMode
		features    []string
		description string
	}

	testCases := []testCase{
		{
			name:        "mode 0 - legacy only",
			dualWrite:   grafanarest.Mode0,
			features:    []string{featuremgmt.FlagKubernetesSnapshots},
			description: "In mode 0, all operations go through legacy storage only",
		},
		{
			name:        "mode 5 - unified storage read-write",
			dualWrite:   grafanarest.Mode5,
			features:    []string{featuremgmt.FlagKubernetesSnapshots},
			description: "In mode 5, all operations go through unified storage only",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				EnableFeatureToggles: tc.features,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					dashv0.SnapshotResourceInfo.GroupResource().String(): {
						DualWriterMode: tc.dualWrite,
					},
				},
			})

			// Use the default org namespace
			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  dashv0.SnapshotResourceInfo.GroupVersionResource(),
			})
			ns := client.Args.Namespace

			t.Log("Testing:", tc.description)

			t.Run("create and get snapshot", func(t *testing.T) {
				// Create a snapshot via the custom /snapshots/create subresource
				key := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, key)

				// Try to get the snapshot
				got, err := client.Resource.Get(context.Background(), key, metav1.GetOptions{})
				require.NoError(t, err, "Failed to get snapshot in mode %d", tc.dualWrite)
				require.NotNil(t, got)
				assert.Equal(t, key, got.GetName())
			})

			t.Run("list snapshots", func(t *testing.T) {
				// Create multiple snapshots
				createdSnapshots := []string{}
				for i := 0; i < 3; i++ {
					key := createSnapshotViaSubresource(t, helper, ns)
					require.NotEmpty(t, key)
					createdSnapshots = append(createdSnapshots, key)
				}

				// List snapshots
				list, err := client.Resource.List(context.Background(), metav1.ListOptions{})

				require.NoError(t, err)
				require.NotNil(t, list)

				items := list.Items
				assert.GreaterOrEqual(t, len(items), 3, "should have at least 3 snapshots")

				// Verify our created snapshots are in the list
				foundCount := 0
				for _, item := range items {
					for _, created := range createdSnapshots {
						if item.GetName() == created {
							foundCount++
							break
						}
					}
				}
				assert.Equal(t, 3, foundCount, "should find all 3 created snapshots")
			})

			t.Run("delete snapshot", func(t *testing.T) {
				// Create a snapshot
				key := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, key)

				// Delete the snapshot
				err := client.Resource.Delete(context.Background(), key, metav1.DeleteOptions{})

				// Both modes should support deletion
				require.NoError(t, err)

				// Verify it's deleted
				_, err = client.Resource.Get(context.Background(), key, metav1.GetOptions{})

				require.Error(t, err, "snapshot should be deleted")
			})
		})
	}
}

// createSnapshotViaSubresource creates a snapshot using the custom /snapshots/create
// subresource endpoint and returns the snapshot key.
func createSnapshotViaSubresource(t *testing.T, helper *apis.K8sTestHelper, ns string) string {
	t.Helper()

	cmd := dashv0.DashboardCreateCommand{
		Name:    "Test Snapshot",
		Expires: 3600,
		Dashboard: &common.Unstructured{
			Object: map[string]interface{}{
				"title":         "Test Dashboard",
				"panels":        []interface{}{},
				"schemaVersion": 39,
				"time": map[string]interface{}{
					"from": "now-6h",
					"to":   "now",
				},
			},
		},
	}

	body, err := json.Marshal(cmd)
	require.NoError(t, err)

	path := fmt.Sprintf("/apis/%s/%s/namespaces/%s/snapshots/create",
		dashv0.SnapshotResourceInfo.GroupVersionResource().Group,
		dashv0.SnapshotResourceInfo.GroupVersionResource().Version,
		ns,
	)

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   path,
		Body:   body,
	}, &dashv0.DashboardCreateResponse{})

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "create snapshot should succeed, body: %s", string(rsp.Body))
	require.NotNil(t, rsp.Result, "response should have a result")
	require.NotEmpty(t, rsp.Result.Key, "response should have a key")

	return rsp.Result.Key
}

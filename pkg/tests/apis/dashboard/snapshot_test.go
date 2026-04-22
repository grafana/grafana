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
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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
			adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  dashv0.SnapshotResourceInfo.GroupVersionResource(),
			})
			ns := adminClient.Args.Namespace

			// Client for a user with no permissions (None role)
			noneClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.None,
				GVR:  dashv0.SnapshotResourceInfo.GroupVersionResource(),
			})

			// Create a dashboard with the UID referenced by snapshot tests,
			// so the dashboard validation in the create handler passes.
			createTestDashboard(t, helper, ns)

			t.Log("Testing:", tc.description)

			t.Run("RBAC denies GET without snapshots:read", func(t *testing.T) {
				// First create a snapshot as admin
				createResp := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, createResp.Key)

				// Try to get the snapshot as a user with no permissions
				_, err := noneClient.Resource.Get(context.Background(), createResp.Key, metav1.GetOptions{})
				require.Error(t, err, "user without snapshots:read should be denied")
				assert.Contains(t, err.Error(), "forbidden", "error should indicate forbidden access")
			})

			t.Run("RBAC denies LIST without snapshots:read", func(t *testing.T) {
				_, err := noneClient.Resource.List(context.Background(), metav1.ListOptions{})
				require.Error(t, err, "user without snapshots:read should be denied")
				assert.Contains(t, err.Error(), "forbidden", "error should indicate forbidden access")
			})

			t.Run("RBAC denies DELETE without snapshots:delete", func(t *testing.T) {
				// First create a snapshot as admin
				createResp := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, createResp.Key)

				// Try to delete the snapshot as a user with no permissions
				err := noneClient.Resource.Delete(context.Background(), createResp.Key, metav1.DeleteOptions{})
				require.Error(t, err, "user without snapshots:delete should be denied")
				assert.Contains(t, err.Error(), "forbidden", "error should indicate forbidden access")
			})

			t.Run("RBAC denies POST /create without snapshots:create", func(t *testing.T) {
				cmd := dashv0.DashboardCreateCommand{
					Name:    "Test Snapshot RBAC",
					Expires: 3600,
					Dashboard: &common.Unstructured{
						Object: map[string]interface{}{
							"title":         "Test Dashboard RBAC",
							"panels":        []interface{}{},
							"schemaVersion": 39,
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
					User:   helper.Org1.None,
					Method: http.MethodPost,
					Path:   path,
					Body:   body,
				}, &dashv0.DashboardCreateResponse{})

				assert.Equal(t, http.StatusForbidden, rsp.Response.StatusCode, "user without snapshots:create should get 403")
			})

			t.Run("RBAC denies DELETE /delete/{deleteKey} without snapshots:delete", func(t *testing.T) {
				// Create a snapshot as admin to get a deleteKey
				createResp := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, createResp.DeleteKey)

				path := fmt.Sprintf("/apis/%s/%s/namespaces/%s/snapshots/delete/%s",
					dashv0.SnapshotResourceInfo.GroupVersionResource().Group,
					dashv0.SnapshotResourceInfo.GroupVersionResource().Version,
					ns,
					createResp.DeleteKey,
				)

				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.None,
					Method: http.MethodDelete,
					Path:   path,
				}, &map[string]interface{}{})

				assert.Equal(t, http.StatusForbidden, rsp.Response.StatusCode, "user without snapshots:delete should get 403")
			})

			t.Run("RBAC denies GET /settings without snapshots:read", func(t *testing.T) {
				path := fmt.Sprintf("/apis/%s/%s/namespaces/%s/snapshots/settings",
					dashv0.SnapshotResourceInfo.GroupVersionResource().Group,
					dashv0.SnapshotResourceInfo.GroupVersionResource().Version,
					ns,
				)

				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.None,
					Method: http.MethodGet,
					Path:   path,
				}, &dashv0.SnapshotSharingOptions{})

				assert.Equal(t, http.StatusForbidden, rsp.Response.StatusCode, "user without snapshots:read should get 403")
			})

			t.Run("create and get snapshot", func(t *testing.T) {
				// Create a snapshot via the custom /snapshots/create subresource
				createResp := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, createResp.Key)

				// Try to get the snapshot
				got, err := adminClient.Resource.Get(context.Background(), createResp.Key, metav1.GetOptions{})
				require.NoError(t, err, "Failed to get snapshot in mode %d", tc.dualWrite)
				require.NotNil(t, got)
				assert.Equal(t, createResp.Key, got.GetName())

				// Verify deleteKey is NOT in the spec
				spec := got.Object["spec"].(map[string]interface{})
				_, hasDeleteKey := spec["deleteKey"]
				assert.False(t, hasDeleteKey, "deleteKey should NOT be present in spec")
			})

			t.Run("get deletekey subresource", func(t *testing.T) {
				// Create a snapshot
				createResp := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, createResp.Key)
				require.NotEmpty(t, createResp.DeleteKey, "create response should contain deleteKey")

				// GET the deletekey subresource
				path := fmt.Sprintf("/apis/%s/%s/namespaces/%s/snapshots/%s/deletekey",
					dashv0.SnapshotResourceInfo.GroupVersionResource().Group,
					dashv0.SnapshotResourceInfo.GroupVersionResource().Version,
					ns,
					createResp.Key,
				)

				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: http.MethodGet,
					Path:   path,
				}, &dashv0.DashboardSnapshotWithDeleteKey{})

				require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "deletekey subresource should succeed, body: %s", string(rsp.Body))
				require.NotNil(t, rsp.Result)
				assert.Equal(t, createResp.DeleteKey, rsp.Result.DeleteKey, "subresource should return the same deleteKey as the create response")
			})

			t.Run("list snapshots", func(t *testing.T) {
				// Create multiple snapshots
				createdSnapshots := []string{}
				for range 3 {
					resp := createSnapshotViaSubresource(t, helper, ns)
					require.NotEmpty(t, resp.Key)
					createdSnapshots = append(createdSnapshots, resp.Key)
				}

				// List snapshots
				list, err := adminClient.Resource.List(context.Background(), metav1.ListOptions{})

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
				resp := createSnapshotViaSubresource(t, helper, ns)
				require.NotEmpty(t, resp.Key)

				// Delete the snapshot
				err := adminClient.Resource.Delete(context.Background(), resp.Key, metav1.DeleteOptions{})

				// Both modes should support deletion
				require.NoError(t, err)

				// Verify it's deleted
				_, err = adminClient.Resource.Get(context.Background(), resp.Key, metav1.GetOptions{})

				require.Error(t, err, "snapshot should be deleted")
			})
		})
	}
}

// createSnapshotViaSubresource creates a snapshot using the custom /snapshots/create
// subresource endpoint and returns the create response (containing key and deleteKey).
func createSnapshotViaSubresource(t *testing.T, helper *apis.K8sTestHelper, ns string) *dashv0.DashboardCreateResponse {
	t.Helper()

	cmd := dashv0.DashboardCreateCommand{
		Name:    "Test Snapshot",
		Expires: 3600,
		Dashboard: &common.Unstructured{
			Object: map[string]interface{}{
				"title":         "Test Dashboard",
				"panels":        []interface{}{},
				"uid":           "a-valid-uid",
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

	return rsp.Result
}

// createTestDashboard creates a dashboard with the UID "a-valid-uid" so that
// snapshot creation (which validates the dashboard exists) can succeed.
func createTestDashboard(t *testing.T, helper *apis.K8sTestHelper, ns string) {
	t.Helper()

	dashClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: ns,
		GVR:       dashv1.DashboardResourceInfo.GroupVersionResource(),
	})

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": dashv1.DashboardResourceInfo.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":      "a-valid-uid",
				"namespace": ns,
			},
			"spec": map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 42,
			},
		},
	}

	_, err := dashClient.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create test dashboard")
}

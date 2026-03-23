package queryhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func newHelper(t *testing.T, mode grafanarest.DualWriterMode) *apis.K8sTestHelper {
	t.Helper()
	flags := []string{
		featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		featuremgmt.FlagKubernetesQueryHistory,
	}

	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableDataMigrations: true,
		AppModeProduction:     false,
		DisableAnonymous:      true,
		EnableFeatureToggles:  flags,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"queryhistories.queryhistory.grafana.app": {
				DualWriterMode: mode,
			},
		},
	})
}

func newQueryHistory(name, datasourceUID string, queries any) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": qhv0alpha1.GroupVersion.String(),
			"kind":       "QueryHistory",
			"metadata":   map[string]any{},
			"spec": map[string]any{
				"datasourceUid": datasourceUID,
				"queries":       queries,
			},
		},
	}
	if name != "" {
		obj.SetName(name)
	} else {
		obj.SetGenerateName("qh-")
	}
	return obj
}

func TestIntegrationQueryHistoryCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []grafanarest.DualWriterMode{
		grafanarest.Mode0,
		grafanarest.Mode1,
		grafanarest.Mode5,
	} {
		t.Run(fmt.Sprintf("mode:%d", mode), func(t *testing.T) {
			helper := newHelper(t, mode)
			ctx := context.Background()

			adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  qhv0alpha1.QueryHistoryResourceInfo.GroupVersionResource(),
			})

			t.Run("list is empty initially", func(t *testing.T) {
				rsp, err := adminClient.Resource.List(ctx, metav1.ListOptions{})
				require.NoError(t, err)
				require.Empty(t, rsp.Items)
			})

			t.Run("create and get", func(t *testing.T) {
				obj := newQueryHistory("", "ds-abc", []any{map[string]any{"refId": "A", "expr": "up"}})
				created, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
				require.NoError(t, err)
				require.NotEmpty(t, created.GetName())
				require.Equal(t, qhv0alpha1.GroupVersion.String(), created.GetAPIVersion())

				// Labels are set by the App SDK mutator which only runs in unified (Mode5)
				if mode >= grafanarest.Mode5 {
					labels := created.GetLabels()
					require.NotEmpty(t, labels["grafana.app/created-by"], "created-by label should be set")
					require.Equal(t, "ds-abc", labels["grafana.app/datasource-uid"])
					require.NotEmpty(t, labels["grafana.app/expires-at"], "expires-at label should be set")
				}

				// Get by name
				found, err := adminClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
				require.NoError(t, err)
				require.Equal(t, created.GetName(), found.GetName())

				spec, ok := found.Object["spec"].(map[string]any)
				require.True(t, ok)
				require.Equal(t, "ds-abc", spec["datasourceUid"])
			})

			t.Run("update comment", func(t *testing.T) {
				obj := newQueryHistory("", "ds-update", []any{map[string]any{"refId": "B", "expr": "rate(http_requests_total[5m])"}})
				created, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
				require.NoError(t, err)

				// Update the comment field (the only mutable spec field)
				comment := "my saved query"
				spec := created.Object["spec"].(map[string]any)
				spec["comment"] = comment
				updated, err := adminClient.Resource.Update(ctx, created, metav1.UpdateOptions{})
				require.NoError(t, err)

				updatedSpec := updated.Object["spec"].(map[string]any)
				require.Equal(t, comment, updatedSpec["comment"])
			})

			// Validation is enforced by the App SDK validator which only runs in unified (Mode5).
			// In Mode0/Mode1, the legacy storage handles writes directly.
			if mode >= grafanarest.Mode5 {
				t.Run("validation rejects missing datasourceUid", func(t *testing.T) {
					obj := newQueryHistory("", "", []any{map[string]any{"refId": "A"}})
					_, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
					require.Error(t, err)
				})

				t.Run("validation rejects empty queries", func(t *testing.T) {
					obj := newQueryHistory("", "ds-abc", []any{})
					_, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
					require.Error(t, err)
				})

				t.Run("validation rejects immutable field change", func(t *testing.T) {
					obj := newQueryHistory("", "ds-immutable", []any{map[string]any{"refId": "C", "expr": "1+1"}})
					created, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
					require.NoError(t, err)

					// Try to change datasourceUid (immutable)
					spec := created.Object["spec"].(map[string]any)
					spec["datasourceUid"] = "ds-other"
					_, err = adminClient.Resource.Update(ctx, created, metav1.UpdateOptions{})
					require.Error(t, err)
				})
			}

			t.Run("delete", func(t *testing.T) {
				obj := newQueryHistory("", "ds-delete", []any{map[string]any{"refId": "D", "expr": "vector(1)"}})
				created, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
				require.NoError(t, err)

				err = adminClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
				require.NoError(t, err)

				_, err = adminClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
				require.Error(t, err)
			})

			t.Run("list returns created items", func(t *testing.T) {
				// Create a few items
				for i := range 3 {
					obj := newQueryHistory("", "ds-list", []any{map[string]any{"refId": fmt.Sprintf("L%d", i), "expr": "up"}})
					_, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
					require.NoError(t, err)
				}

				rsp, err := adminClient.Resource.List(ctx, metav1.ListOptions{})
				require.NoError(t, err)
				// At least the 3 we just created (plus any from earlier subtests that weren't deleted)
				require.GreaterOrEqual(t, len(rsp.Items), 3)
			})
		})
	}
}

func TestIntegrationQueryHistoryAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := newHelper(t, grafanarest.Mode5)
	ctx := context.Background()

	gvr := qhv0alpha1.QueryHistoryResourceInfo.GroupVersionResource()

	adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})
	viewerClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Viewer,
		GVR:  gvr,
	})

	t.Run("viewer can create own query history", func(t *testing.T) {
		obj := newQueryHistory("", "ds-viewer", []any{map[string]any{"refId": "V", "expr": "up"}})
		created, err := viewerClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, created.GetName())
	})

	t.Run("admin cannot get viewer item by name", func(t *testing.T) {
		// Viewer creates an item
		viewerObj := newQueryHistory("", "ds-viewer-private", []any{map[string]any{"refId": "P", "expr": "up"}})
		viewerCreated, err := viewerClient.Resource.Create(ctx, viewerObj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Admin tries to get the viewer's item — ownership check should deny access
		_, err = adminClient.Resource.Get(ctx, viewerCreated.GetName(), metav1.GetOptions{})
		require.Error(t, err, "admin should not be able to get viewer's query history item")

		// Admin tries to update the viewer's item — should be denied
		viewerCreated.SetAnnotations(map[string]string{"test": "hack"})
		_, err = adminClient.Resource.Update(ctx, viewerCreated, metav1.UpdateOptions{})
		require.Error(t, err, "admin should not be able to update viewer's query history item")

		// Admin tries to delete the viewer's item — should be denied
		err = adminClient.Resource.Delete(ctx, viewerCreated.GetName(), metav1.DeleteOptions{})
		require.Error(t, err, "admin should not be able to delete viewer's query history item")

		// Viewer can still access their own item
		_, err = viewerClient.Resource.Get(ctx, viewerCreated.GetName(), metav1.GetOptions{})
		require.NoError(t, err, "viewer should be able to get their own query history item")
	})
}

func TestIntegrationQueryHistorySearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := newHelper(t, grafanarest.Mode5)

	gvr := qhv0alpha1.QueryHistoryResourceInfo.GroupVersionResource()

	adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	ctx := context.Background()

	// Create some items to search through
	for i := range 3 {
		dsUID := fmt.Sprintf("ds-search-%d", i)
		obj := newQueryHistory("", dsUID, []any{map[string]any{"refId": "S", "expr": fmt.Sprintf("query_%d", i)}})
		_, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Run("search returns results", func(t *testing.T) {
		// Search is a named sub-resource: /queryhistories/{name}/search
		// The name is required by the k8s sub-resource pattern but the search
		// handler ignores it (it searches across all user items).
		list, err := adminClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, list.Items, "should have items to search")
		firstName := list.Items[0].GetName()

		type searchResponse struct {
			Items      []json.RawMessage `json:"items"`
			TotalCount int64             `json:"totalCount"`
		}
		result := apis.DoRequest(helper, apis.RequestParams{
			User: adminClient.Args.User,
			Path: fmt.Sprintf("/apis/%s/%s/namespaces/default/queryhistories/%s/search",
				gvr.Group, gvr.Version, firstName),
		}, &searchResponse{})
		require.Equal(t, 200, result.Response.StatusCode)
		require.GreaterOrEqual(t, result.Result.TotalCount, int64(3))
	})
}

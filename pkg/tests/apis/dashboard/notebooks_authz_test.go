package dashboards

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	searchV0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Notebook access is granted by the fixed:notebooks:reader (Viewer) and
// fixed:notebooks:writer (Editor) roles. This checks that the API actually
// enforces them: a user with no notebook permissions must not read or write, and
// a Viewer must be able to read but not mutate.
func TestIntegrationNotebooksAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableFeatureToggles: []string{featuremgmt.FlagDashboardNotebooks},
	})
	defer helper.Shutdown()

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "notebooks",
	}
	client := func(user apis.User) *apis.K8sResourceClient {
		return helper.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: gvr})
	}

	const seeded = "nbauthz-seeded"
	createNotebook(t, ctx, client(helper.Org1.Admin), gvr, seeded, "Seeded by admin")

	patch := []byte(`{"spec":{"title":"Edited"}}`)

	t.Run("role none is denied every operation", func(t *testing.T) {
		c := client(helper.Org1.None)

		_, err := c.Resource.List(ctx, metav1.ListOptions{})
		require.True(t, apierrors.IsForbidden(err), "list: expected Forbidden, got %v", err)

		_, err = c.Resource.Get(ctx, seeded, metav1.GetOptions{})
		require.True(t, apierrors.IsForbidden(err), "get: expected Forbidden, got %v", err)

		_, err = c.Resource.Patch(ctx, seeded, types.MergePatchType, patch, metav1.PatchOptions{})
		require.True(t, apierrors.IsForbidden(err), "patch: expected Forbidden, got %v", err)

		err = c.Resource.Delete(ctx, seeded, metav1.DeleteOptions{})
		require.True(t, apierrors.IsForbidden(err), "delete: expected Forbidden, got %v", err)
	})

	// A search is a POST the API server parses as a create. Through the full authorizer
	// chain it is restated as a list, so it follows the read permission.
	t.Run("search follows the read permission", func(t *testing.T) {
		query := searchV0.SearchQuery{Limit: 10}

		_, code := search(t, ctx, helper.Org1.None, gvr, query)
		require.Equal(t, http.StatusForbidden, code, "role none must not search")

		results, code := search(t, ctx, helper.Org1.Viewer, gvr, query)
		require.Equal(t, http.StatusOK, code, "viewer must be able to search")
		require.Contains(t, names(results), seeded)

		_, code = search(t, ctx, helper.Org1.Editor, gvr, query)
		require.Equal(t, http.StatusOK, code, "editor must be able to search")
	})

	t.Run("viewer can read but not mutate", func(t *testing.T) {
		c := client(helper.Org1.Viewer)

		list, err := c.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)

		got, err := c.Resource.Get(ctx, seeded, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, seeded, got.GetName())

		_, err = c.Resource.Patch(ctx, seeded, types.MergePatchType, patch, metav1.PatchOptions{})
		require.True(t, apierrors.IsForbidden(err), "patch: expected Forbidden, got %v", err)

		got.Object["spec"].(map[string]any)["title"] = "Edited"
		_, err = c.Resource.Update(ctx, got, metav1.UpdateOptions{})
		require.True(t, apierrors.IsForbidden(err), "update: expected Forbidden, got %v", err)

		err = c.Resource.Delete(ctx, seeded, metav1.DeleteOptions{})
		require.True(t, apierrors.IsForbidden(err), "delete: expected Forbidden, got %v", err)

		after, err := client(helper.Org1.Admin).Resource.Get(ctx, seeded, metav1.GetOptions{})
		require.NoError(t, err, "a denied delete must leave the notebook in place")
		require.Equal(t, "Seeded by admin", after.Object["spec"].(map[string]any)["title"], "a denied write must not change the notebook")
	})

	t.Run("editor can read and mutate", func(t *testing.T) {
		c := client(helper.Org1.Editor)

		_, err := c.Resource.Get(ctx, seeded, metav1.GetOptions{})
		require.NoError(t, err)

		created := createNotebook(t, ctx, c, gvr, "nbauthz-editor", "Created by editor")

		patched, err := c.Resource.Patch(ctx, created.GetName(), types.MergePatchType, patch, metav1.PatchOptions{})
		require.NoError(t, err)
		require.Equal(t, "Edited", patched.Object["spec"].(map[string]any)["title"])

		require.NoError(t, c.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
	})
}

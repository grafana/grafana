package collections

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func slideshowObject(name string, spec map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": collections.SlideshowResourceInfo.GroupVersion().String(),
		"kind":       "Slideshow",
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       spec,
	}}
}

func TestIntegrationSlideshows(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false, // required for experimental APIs
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs},
	})

	gvr := collections.SlideshowResourceInfo.GroupVersionResource()
	admin := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
	viewer := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Viewer, GVR: gvr})
	ctx := context.Background()

	spec := map[string]any{
		"title":    "NOC wall",
		"interval": "5m",
		"items": []any{
			map[string]any{"group": "dashboard.grafana.app", "resource": "dashboards", "name": "cpu", "interval": "30s"},
			map[string]any{"group": "dashboard.grafana.app", "resource": "notebooks", "name": "nb1"},
			map[string]any{"group": "assistant.ext.grafana.app", "resource": "pages", "name": "p1"},
		},
	}

	t.Run("round trips through create, get, update, list and delete", func(t *testing.T) {
		created, err := admin.Resource.Create(ctx, slideshowObject("noc-wall", spec), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "noc-wall", created.GetName())

		got, err := admin.Resource.Get(ctx, "noc-wall", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, spec, got.Object["spec"])

		updatedSpec := map[string]any{"title": "NOC wall v2", "interval": "1m", "items": spec["items"].([]any)[:1]}
		got.Object["spec"] = updatedSpec
		updated, err := admin.Resource.Update(ctx, got, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, updatedSpec, updated.Object["spec"])

		list, err := admin.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "noc-wall", list.Items[0].GetName())

		require.NoError(t, admin.Resource.Delete(ctx, "noc-wall", metav1.DeleteOptions{}))
		_, err = admin.Resource.Get(ctx, "noc-wall", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected not found, got %v", err)
	})

	t.Run("rejects an invalid slideshow with the validation message", func(t *testing.T) {
		bad := map[string]any{
			"title":    "",
			"interval": "1s",
			"items":    []any{map[string]any{"group": "", "resource": "dashboards", "name": "cpu"}},
		}
		_, err := admin.Resource.Create(ctx, slideshowObject("bad", bad), metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err), "expected invalid, got %v", err)
		require.Contains(t, err.Error(), "spec.title")
		require.Contains(t, err.Error(), "spec.interval")
		require.Contains(t, err.Error(), "spec.items[0].group")
	})

	t.Run("viewers can read but not write", func(t *testing.T) {
		_, err := admin.Resource.Create(ctx, slideshowObject("shared", spec), metav1.CreateOptions{})
		require.NoError(t, err)

		_, err = viewer.Resource.Get(ctx, "shared", metav1.GetOptions{})
		require.NoError(t, err)

		_, err = viewer.Resource.Create(ctx, slideshowObject("viewer-made", spec), metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
	})
}

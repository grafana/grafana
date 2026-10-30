package folder

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
)

func TestGroupRouter(t *testing.T) {
	dashboards := schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "dashboards"}
	other := schema.GroupVersionResource{Group: "other.grafana.app", Version: "v1", Resource: "others"}

	object := func(gvr schema.GroupVersionResource, kind string) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": gvr.GroupVersion().String(),
			"kind":       kind,
			"metadata":   map[string]any{"name": "x", "namespace": "ns"},
		}}
	}
	list := map[schema.GroupVersionResource]string{
		folderGVR: "FolderList", dashboards: "DashboardList", other: "OtherList",
	}
	// Each server only knows its own objects, like the real apiservers do.
	folderServer := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), list, object(folderGVR, "Folder"))
	dashboardServer := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), list, object(dashboards, "Dashboard"))
	router := groupRouter{
		byGroup:  map[string]dynamic.Interface{folderGVR.Group: folderServer, dashboards.Group: dashboardServer},
		fallback: folderServer,
	}

	_, err := router.Resource(folderGVR).Namespace("ns").Get(t.Context(), "x", metav1.GetOptions{})
	require.NoError(t, err, "folders go to the folder server")

	_, err = router.Resource(dashboards).Namespace("ns").Get(t.Context(), "x", metav1.GetOptions{})
	require.NoError(t, err, "dashboards go to the dashboard server, not the folder one")

	_, err = folderServer.Resource(dashboards).Namespace("ns").Get(t.Context(), "x", metav1.GetOptions{})
	require.Error(t, err, "the folder server has no dashboards, which is what a single client would have hit")

	_, err = router.Resource(other).Namespace("ns").Get(t.Context(), "x", metav1.GetOptions{})
	require.Error(t, err, "an unrouted group reaches the fallback")
}

package defaultpermissions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	authlib "github.com/grafana/authlib/types"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var testGVR = dashv1.DashboardResourceInfo.GroupVersionResource()

var testDefaults = []Permission{
	{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
	{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
}

func newFakeClient(objs ...runtime.Object) (*dynamicfake.FakeDynamicClient, ClientGetter) {
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"}: "ResourcePermissionList"},
		objs...)
	return dyn, func(context.Context) (*dynamic.NamespaceableResourceInterface, error) {
		c := dyn.Resource(schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"})
		return &c, nil
	}
}

func testObj(t *testing.T, name, namespace string) utils.GrafanaMetaAccessor {
	t.Helper()
	d := &dashv1.Dashboard{}
	d.SetName(name)
	d.SetNamespace(namespace)
	meta, err := utils.MetaAccessor(d)
	require.NoError(t, err)
	return meta
}

func TestNewSetter(t *testing.T) {
	ctx := authlib.WithAuthInfo(context.Background(),
		&identity.StaticRequester{UserID: 1, UserUID: "user-uid", OrgID: 1, Type: authlib.TypeUser})

	t.Run("no-op when the client getter returns nil", func(t *testing.T) {
		setter := NewSetter(Config{
			GVR:           testGVR,
			Client:        func(context.Context) (*dynamic.NamespaceableResourceInterface, error) { return nil, nil },
			BuildDefaults: func(authlib.AuthInfo) []Permission { return testDefaults },
		})
		require.NoError(t, setter(ctx, nil, nil, testObj(t, "dash1", "default")))
	})

	t.Run("creates a new ResourcePermission when none exists", func(t *testing.T) {
		dyn, getter := newFakeClient()
		setter := NewSetter(Config{
			GVR:           testGVR,
			Client:        getter,
			BuildDefaults: func(authlib.AuthInfo) []Permission { return testDefaults },
		})
		require.NoError(t, setter(ctx, nil, nil, testObj(t, "dash1", "default")))

		gvr := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"}
		got, err := dyn.Resource(gvr).Namespace("default").Get(context.Background(), "dashboard.grafana.app-dashboards-dash1", metav1.GetOptions{})
		require.NoError(t, err)
		perms, found, err := unstructured.NestedSlice(got.Object, "spec", "permissions")
		require.NoError(t, err)
		require.True(t, found)
		require.Len(t, perms, 2)
	})

	t.Run("adds missing defaults without touching existing custom permissions", func(t *testing.T) {
		existing := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind":       "ResourcePermission",
			"metadata": map[string]any{
				"name":      "dashboard.grafana.app-dashboards-dash1",
				"namespace": "default",
			},
			"spec": map[string]any{
				"resource": map[string]any{
					"apiGroup": testGVR.Group,
					"resource": testGVR.Resource,
					"name":     "dash1",
				},
				"permissions": []any{
					map[string]any{"kind": "User", "name": "someone-else", "verb": "admin"},
					// A subject that already has a grant should keep it, not get overwritten
					// by the fixed default for that same subject.
					map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
				},
			},
		}}
		dyn, getter := newFakeClient(existing)
		setter := NewSetter(Config{
			GVR:           testGVR,
			Client:        getter,
			BuildDefaults: func(authlib.AuthInfo) []Permission { return testDefaults },
		})
		require.NoError(t, setter(ctx, nil, nil, testObj(t, "dash1", "default")))

		gvr := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"}
		got, err := dyn.Resource(gvr).Namespace("default").Get(context.Background(), "dashboard.grafana.app-dashboards-dash1", metav1.GetOptions{})
		require.NoError(t, err)
		perms, _, err := unstructured.NestedSlice(got.Object, "spec", "permissions")
		require.NoError(t, err)

		// someone-else:admin and Editor:admin (untouched) plus the missing Viewer:view default = 3.
		require.Len(t, perms, 3)
		var sawEditorAdmin, sawViewerView, sawSomeoneElse bool
		for _, p := range perms {
			entry := p.(map[string]any)
			switch {
			case entry["kind"] == "BasicRole" && entry["name"] == "Editor":
				require.Equal(t, "admin", entry["verb"], "existing Editor grant must not be downgraded to the edit default")
				sawEditorAdmin = true
			case entry["kind"] == "BasicRole" && entry["name"] == "Viewer":
				require.Equal(t, "view", entry["verb"])
				sawViewerView = true
			case entry["kind"] == "User" && entry["name"] == "someone-else":
				sawSomeoneElse = true
			}
		}
		require.True(t, sawEditorAdmin, "existing Editor permission should be preserved")
		require.True(t, sawViewerView, "missing Viewer default should be added")
		require.True(t, sawSomeoneElse, "unrelated existing permission should be preserved")
	})
}

package resourcepermission

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func TestMergeMissingPermissions(t *testing.T) {
	defaults := []map[string]any{
		{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
	}

	tests := []struct {
		name        string
		current     []any
		want        []any
		wantChanged bool
	}{
		{
			name:        "no permissions yet adds every default",
			current:     nil,
			want:        []any{map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"}, map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"}},
			wantChanged: true,
		},
		{
			name:    "an existing subject keeps its own verb",
			current: []any{map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "admin"}},
			want: []any{
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			},
			wantChanged: true,
		},
		{
			name: "unrelated subjects are preserved",
			current: []any{
				map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
				map[string]any{"kind": "User", "name": "u1", "verb": "admin"},
			},
			want: []any{
				map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
				map[string]any{"kind": "User", "name": "u1", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
		{
			name: "every default already present changes nothing",
			current: []any{
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			want: []any{
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := mergeMissingPermissions(tt.current, defaults)
			require.Equal(t, tt.wantChanged, changed)
			require.Equal(t, tt.want, got)
		})
	}

	t.Run("the default list is not mutated", func(t *testing.T) {
		merged, _ := mergeMissingPermissions(nil, defaults)
		merged[0].(map[string]any)["verb"] = "admin"
		require.Equal(t, "edit", defaults[0]["verb"])
	})
}

func TestAddMissingPermissions(t *testing.T) {
	gvr := iamv0alpha1.ResourcePermissionInfo.GroupVersionResource()
	const name = "dashboard.grafana.app-dashboards-dash"

	newClient := func(permissions []any) (*unstructured.Unstructured, *dynamicfake.FakeDynamicClient) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": gvr.GroupVersion().String(),
			"kind":       "ResourcePermission",
			"metadata":   map[string]any{"name": name, "namespace": "default"},
			"spec": map[string]any{
				"resource":    map[string]any{"apiGroup": "dashboard.grafana.app", "resource": "dashboards", "name": "dash"},
				"permissions": permissions,
			},
		}}
		dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
			map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"}, obj)
		return obj, dyn
	}

	defaults := []map[string]any{
		{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
	}

	t.Run("adds only the missing defaults", func(t *testing.T) {
		obj, dyn := newClient([]any{
			map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "admin"},
		})
		client := dyn.Resource(gvr).Namespace("default")
		require.NoError(t, AddMissingPermissions(t.Context(), client, obj, defaults))

		stored, err := client.Get(t.Context(), name, metav1.GetOptions{})
		require.NoError(t, err)
		permissions, _, err := unstructured.NestedSlice(stored.Object, "spec", "permissions")
		require.NoError(t, err)
		require.Equal(t, []any{
			map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		}, permissions)
	})

	t.Run("writes nothing when the defaults are already covered", func(t *testing.T) {
		obj, dyn := newClient([]any{
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
		})
		client := dyn.Resource(gvr).Namespace("default")
		require.NoError(t, AddMissingPermissions(t.Context(), client, obj, defaults))

		for _, action := range dyn.Actions() {
			require.NotEqual(t, "update", action.GetVerb(), "nothing to add must not issue a write")
		}
	})
}

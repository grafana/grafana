package resourcepermission

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"
)

func TestMergeDefaultPermissions(t *testing.T) {
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
			name:    "no existing permissions returns the defaults",
			current: nil,
			want: []any{
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
		{
			name: "existing grants are kept and only missing defaults are added",
			current: []any{
				map[string]any{"kind": "User", "name": "someone-else", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
			},
			want: []any{
				map[string]any{"kind": "User", "name": "someone-else", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
		{
			name: "nothing changes when every default subject already has a grant",
			current: []any{
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			},
			want: []any{
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			},
			wantChanged: false,
		},
		{
			name:    "malformed entries are dropped",
			current: []any{"not-a-map", map[string]any{"kind": "Team", "name": "team-a", "verb": "view"}},
			want: []any{
				map[string]any{"kind": "Team", "name": "team-a", "verb": "view"},
				map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			},
			wantChanged: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := MergeDefaultPermissions(tt.current, defaults)
			require.Equal(t, tt.want, got)
			require.Equal(t, tt.wantChanged, changed)
		})
	}
}

func TestInheritedPermissions(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "resourcepermissions"}
	folderPermissions := func(uid string, permissions ...map[string]any) *unstructured.Unstructured {
		entries := make([]any, 0, len(permissions))
		for _, p := range permissions {
			entries = append(entries, p)
		}
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind":       "ResourcePermission",
			"metadata":   map[string]any{"name": "folder.grafana.app-folders-" + uid, "namespace": "default"},
			"spec": map[string]any{
				"resource":    map[string]any{"apiGroup": "folder.grafana.app", "resource": "folders", "name": uid},
				"permissions": entries,
			},
		}}
	}
	newClient := func(objs ...runtime.Object) *dynamicfake.FakeDynamicClient {
		return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
			map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"}, objs...)
	}
	chain := map[string][]string{
		"child": {"root", "middle", "child"},
		"alone": {"alone"},
	}
	parents := func(_ context.Context, uid string) ([]string, error) {
		if c, ok := chain[uid]; ok {
			return c, nil
		}
		return nil, errors.New("unknown folder")
	}
	ctx := context.Background()

	t.Run("unions the folder and its ancestors, broadest verb per subject wins", func(t *testing.T) {
		dyn := newClient(
			folderPermissions("root",
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
				map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
			),
			// middle has no ResourcePermission: skipped
			folderPermissions("child",
				map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				map[string]any{"kind": "User", "name": "u1", "verb": "admin"},
			),
		)
		got, err := InheritedPermissions(ctx, dyn.Resource(gvr).Namespace("default"), parents, "child")
		require.NoError(t, err)
		require.ElementsMatch(t, []map[string]any{
			{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
			{"kind": "Team", "name": "team-a", "verb": "edit"},
			{"kind": "User", "name": "u1", "verb": "admin"},
		}, got)
	})

	t.Run("a narrower verb lower in the tree does not override a broader one", func(t *testing.T) {
		dyn := newClient(
			folderPermissions("root", map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"}),
			folderPermissions("child", map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "view"}),
		)
		got, err := InheritedPermissions(ctx, dyn.Resource(gvr).Namespace("default"), parents, "child")
		require.NoError(t, err)
		require.Equal(t, []map[string]any{{"kind": "BasicRole", "name": "Editor", "verb": "admin"}}, got)
	})

	t.Run("a folder tree without permissions inherits nothing", func(t *testing.T) {
		got, err := InheritedPermissions(ctx, newClient().Resource(gvr).Namespace("default"), parents, "alone")
		require.NoError(t, err)
		require.Empty(t, got)
	})

	t.Run("fails when the parents cannot be resolved", func(t *testing.T) {
		_, err := InheritedPermissions(ctx, newClient().Resource(gvr).Namespace("default"), parents, "missing")
		require.ErrorContains(t, err, "unknown folder")
	})

	t.Run("surfaces unexpected read errors", func(t *testing.T) {
		dyn := newClient()
		dyn.PrependReactor("get", "resourcepermissions", func(action k8stesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("boom")
		})
		_, err := InheritedPermissions(ctx, dyn.Resource(gvr).Namespace("default"), parents, "alone")
		require.ErrorContains(t, err, "boom")
	})
}

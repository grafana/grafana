package folders

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

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TestSetDefaultFolderPermissionsKeepExisting covers the path where the folder already has a
// ResourcePermission object — it reached the root by a move, or its record was pre-seeded on
// create — and the setter must only add the missing defaults. The create path, which replaces the
// whole list, is unchanged and covered by the integration tests: the fake dynamic client cannot
// deep-copy the []map[string]any list it writes.
func TestSetDefaultFolderPermissionsKeepExisting(t *testing.T) {
	gvr := iamv0alpha1.ResourcePermissionInfo.GroupVersionResource()
	const permissionName = "folder.grafana.app-folders-fold"

	newBuilder := func(existing ...runtime.Object) (*FolderAPIBuilder, dynamic.ResourceInterface) {
		dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
			map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"}, existing...)
		client := dyn.Resource(gvr)
		return &FolderAPIBuilder{resourcePermissionsSvc: &client}, client.Namespace("default")
	}

	existingPermission := func(permissions ...any) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": gvr.GroupVersion().String(),
			"kind":       "ResourcePermission",
			"metadata":   map[string]any{"name": permissionName, "namespace": "default"},
			"spec": map[string]any{
				"resource":    map[string]any{"apiGroup": "folder.grafana.app", "resource": "folders", "name": "fold"},
				"permissions": permissions,
			},
		}}
	}

	folderMeta := func(t *testing.T, parentUID string) utils.GrafanaMetaAccessor {
		t.Helper()
		meta, err := utils.MetaAccessor(&foldersv1.Folder{
			ObjectMeta: metav1.ObjectMeta{Name: "fold", Namespace: "default"},
		})
		require.NoError(t, err)
		meta.SetFolder(parentUID)
		return meta
	}

	key := &resourcepb.ResourceKey{
		Group: "folder.grafana.app", Resource: "folders", Name: "fold", Namespace: "default",
	}
	provisioning := &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "default"}

	t.Run("adds only the missing defaults", func(t *testing.T) {
		b, client := newBuilder(existingPermission(
			map[string]any{"kind": "User", "name": "u1", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "view"},
		))
		ctx := apistore.WithKeepExistingPermissions(context.Background())
		require.NoError(t, b.setDefaultFolderPermissions(ctx, key, provisioning, folderMeta(t, "")))

		stored, err := client.Get(context.Background(), permissionName, metav1.GetOptions{})
		require.NoError(t, err)
		permissions, _, err := unstructured.NestedSlice(stored.Object, "spec", "permissions")
		require.NoError(t, err)
		require.Equal(t, []any{
			map[string]any{"kind": "User", "name": "u1", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "view"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
		}, permissions, "the pre-seeded admin and the narrower Editor grant must both survive")
	})

	t.Run("a nested folder is left alone", func(t *testing.T) {
		b, client := newBuilder()
		ctx := apistore.WithKeepExistingPermissions(context.Background())
		require.NoError(t, b.setDefaultFolderPermissions(ctx, key, provisioning, folderMeta(t, "parent")))

		_, err := client.Get(context.Background(), permissionName, metav1.GetOptions{})
		require.Error(t, err, "a nested folder inherits access and needs no record of its own")
	})
}

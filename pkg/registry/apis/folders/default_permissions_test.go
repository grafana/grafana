package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	authlib "github.com/grafana/authlib/types"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSetDefaultFolderPermissions(t *testing.T) {
	gvr := iamv0alpha1.ResourcePermissionInfo.GroupVersionResource()
	const permissionName = "folder.grafana.app-folders-fold"

	newBuilder := func(objs ...runtime.Object) (*FolderAPIBuilder, *dynamicfake.FakeDynamicClient) {
		dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
			map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"}, objs...)
		client := dyn.Resource(gvr)
		return &FolderAPIBuilder{resourcePermissionsSvc: &client}, dyn
	}

	folderMeta := func(t *testing.T, parentUID string) utils.GrafanaMetaAccessor {
		t.Helper()
		f := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "fold", Namespace: "default"}}
		meta, err := utils.MetaAccessor(f)
		require.NoError(t, err)
		if parentUID != "" {
			meta.SetFolder(parentUID)
		}
		return meta
	}

	storedPermissions := func(t *testing.T, dyn *dynamicfake.FakeDynamicClient) []any {
		t.Helper()
		stored, err := dyn.Resource(gvr).Namespace("default").Get(context.Background(), permissionName, metav1.GetOptions{})
		require.NoError(t, err)
		permissions, _, err := unstructured.NestedSlice(stored.Object, "spec", "permissions")
		require.NoError(t, err)
		return permissions
	}

	key := &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Name: "fold", Namespace: "default"}
	creator := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "creator"}
	ctx := context.Background()

	t.Run("creates the default permissions when none exist", func(t *testing.T) {
		b, dyn := newBuilder()
		require.NoError(t, b.setDefaultFolderPermissions(ctx, key, creator, folderMeta(t, "")))

		require.Equal(t, []any{
			map[string]any{"kind": "User", "name": "creator", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
		}, storedPermissions(t, dyn))
	})

	t.Run("adds only the missing defaults to existing permissions", func(t *testing.T) {
		existing := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": gvr.GroupVersion().String(),
			"kind":       "ResourcePermission",
			"metadata":   map[string]any{"name": permissionName, "namespace": "default"},
			"spec": map[string]any{
				"resource": map[string]any{"apiGroup": "folder.grafana.app", "resource": "folders", "name": "fold"},
				"permissions": []any{
					map[string]any{"kind": "BasicRole", "name": "Admin", "verb": "admin"},
					// An existing grant for a default subject must not be lowered to the default.
					map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				},
			},
		}}
		b, dyn := newBuilder(existing)
		require.NoError(t, b.setDefaultFolderPermissions(ctx, key, &identity.StaticRequester{Type: authlib.TypeAccessPolicy}, folderMeta(t, "")))

		require.Equal(t, []any{
			map[string]any{"kind": "BasicRole", "name": "Admin", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		}, storedPermissions(t, dyn))
	})

	t.Run("a folder moved to the root keeps the access it inherited from its old parent tree", func(t *testing.T) {
		folderPermissions := func(uid string, permissions ...any) *unstructured.Unstructured {
			return &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": gvr.GroupVersion().String(),
				"kind":       "ResourcePermission",
				"metadata":   map[string]any{"name": "folder.grafana.app-folders-" + uid, "namespace": "default"},
				"spec": map[string]any{
					"resource":    map[string]any{"apiGroup": "folder.grafana.app", "resource": "folders", "name": uid},
					"permissions": permissions,
				},
			}}
		}
		b, dyn := newBuilder(
			folderPermissions("root", map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"}),
			folderPermissions("parent", map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"}),
		)

		storage := grafanarest.NewMockStorage(t)
		storage.On("Get", mock.Anything, "parent", mock.Anything).Return(&foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "parent"}}, nil)
		b.storage = storage
		b.parents = func(_ context.Context, f *foldersv1.Folder) (*foldersv1.FolderInfoList, error) {
			require.Equal(t, "parent", f.Name)
			return &foldersv1.FolderInfoList{Items: []foldersv1.FolderInfo{{Name: "root"}, {Name: "parent", Parent: "root"}}}, nil
		}

		movedCtx := apistore.WithInheritedFrom(ctx, "parent")
		require.NoError(t, b.setDefaultFolderPermissions(movedCtx, key, creator, folderMeta(t, "")))

		// Only what the old parent tree granted: no generic defaults and no admin for the mover.
		require.ElementsMatch(t, []any{
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
			map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
		}, storedPermissions(t, dyn))
	})

	t.Run("does nothing for a nested folder", func(t *testing.T) {
		b, dyn := newBuilder()
		require.NoError(t, b.setDefaultFolderPermissions(ctx, key, creator, folderMeta(t, "parent")))

		_, err := dyn.Resource(gvr).Namespace("default").Get(context.Background(), permissionName, metav1.GetOptions{})
		require.Error(t, err)
	})
}

package dashboard

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

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSetDefaultDashboardPermissions(t *testing.T) {
	gvr := iamv0alpha1.ResourcePermissionInfo.GroupVersionResource()
	const permissionName = "dashboard.grafana.app-dashboards-dash"

	newBuilder := func(objs ...runtime.Object) (*DashboardsAPIBuilder, *dynamicfake.FakeDynamicClient) {
		dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
			map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"}, objs...)
		client := dyn.Resource(gvr)
		return &DashboardsAPIBuilder{resourcePermissionsSvc: &client}, dyn
	}

	dashboardMeta := func(t *testing.T, folderUID string) utils.GrafanaMetaAccessor {
		t.Helper()
		dash := &dashv1.Dashboard{ObjectMeta: metav1.ObjectMeta{Name: "dash", Namespace: "default"}}
		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)
		if folderUID != "" {
			meta.SetFolder(folderUID)
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

	key := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash", Namespace: "default"}
	creator := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "creator"}
	ctx := context.Background()

	t.Run("creates the default permissions when none exist", func(t *testing.T) {
		b, dyn := newBuilder()
		require.NoError(t, b.setDefaultDashboardPermissions(ctx, key, creator, dashboardMeta(t, "")))

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
				"resource": map[string]any{"apiGroup": "dashboard.grafana.app", "resource": "dashboards", "name": "dash"},
				"permissions": []any{
					map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
					// An existing grant for a default subject must not be lowered to the default.
					map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
				},
			},
		}}
		b, dyn := newBuilder(existing)
		require.NoError(t, b.setDefaultDashboardPermissions(ctx, key, &identity.StaticRequester{Type: authlib.TypeAccessPolicy}, dashboardMeta(t, "")))

		require.Equal(t, []any{
			map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		}, storedPermissions(t, dyn))
	})

	t.Run("a dashboard moved to the root keeps the access it inherited from its old folder tree", func(t *testing.T) {
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
			folderPermissions("root", map[string]any{"kind": "Team", "name": "team-a", "verb": "view"}),
			folderPermissions("child", map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"}),
		)

		parents, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&foldersv1.FolderInfoList{Items: []foldersv1.FolderInfo{
			{Name: "root"}, {Name: "child", Parent: "root"}, {Name: "gone", Detached: true},
		}})
		require.NoError(t, err)
		handler := new(client.MockK8sHandler)
		handler.On("Get", mock.Anything, "child", int64(1), mock.Anything, []string{"parents"}).Return(&unstructured.Unstructured{Object: parents}, nil)
		b.folderClientProvider = newSimpleClientProvider(handler)

		movedCtx := apistore.WithInheritedFrom(ctx, "child")
		require.NoError(t, b.setDefaultDashboardPermissions(movedCtx, key, creator, dashboardMeta(t, "")))

		// Only what the old folder tree granted: no generic defaults and no admin for the mover.
		require.ElementsMatch(t, []any{
			map[string]any{"kind": "Team", "name": "team-a", "verb": "view"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "admin"},
		}, storedPermissions(t, dyn))
	})

	t.Run("does nothing for a dashboard inside a folder", func(t *testing.T) {
		b, dyn := newBuilder()
		require.NoError(t, b.setDefaultDashboardPermissions(ctx, key, creator, dashboardMeta(t, "parent")))

		_, err := dyn.Resource(gvr).Namespace("default").Get(context.Background(), permissionName, metav1.GetOptions{})
		require.Error(t, err)
	})
}

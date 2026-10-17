package dashboard

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
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TestSetDefaultDashboardPermissionsKeepExisting covers the move-to-root path, where the dashboard
// already has a ResourcePermission object and the setter must only add the missing defaults.
// The create path, which replaces the whole list, is unchanged and covered by the integration
// tests: the fake dynamic client cannot deep-copy the []map[string]any list it writes.
func TestSetDefaultDashboardPermissionsKeepExisting(t *testing.T) {
	gvr := iamv0alpha1.ResourcePermissionInfo.GroupVersionResource()
	const permissionName = "dashboard.grafana.app-dashboards-dash"

	newBuilder := func(existing ...runtime.Object) (*DashboardsAPIBuilder, dynamic.ResourceInterface) {
		dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
			map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"}, existing...)
		client := dyn.Resource(gvr)
		return &DashboardsAPIBuilder{resourcePermissionsSvc: &client}, client.Namespace("default")
	}

	existingPermission := func(permissions ...any) *unstructured.Unstructured {
		return &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": gvr.GroupVersion().String(),
			"kind":       "ResourcePermission",
			"metadata":   map[string]any{"name": permissionName, "namespace": "default"},
			"spec": map[string]any{
				"resource":    map[string]any{"apiGroup": "dashboard.grafana.app", "resource": "dashboards", "name": "dash"},
				"permissions": permissions,
			},
		}}
	}

	dashboardMeta := func(t *testing.T, folderUID string) utils.GrafanaMetaAccessor {
		t.Helper()
		meta, err := utils.MetaAccessor(&dashv1.Dashboard{
			ObjectMeta: metav1.ObjectMeta{Name: "dash", Namespace: "default"},
		})
		require.NoError(t, err)
		meta.SetFolder(folderUID)
		return meta
	}

	key := &resourcepb.ResourceKey{
		Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash", Namespace: "default",
	}
	// An access policy, which is how the provisioning service identifies itself. It gets no
	// creator-admin grant, so only the basic-role defaults apply.
	provisioning := &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "default"}

	t.Run("adds only the missing defaults", func(t *testing.T) {
		b, client := newBuilder(existingPermission(
			map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "admin"},
		))
		ctx := apistore.WithKeepExistingPermissions(context.Background())
		require.NoError(t, b.setDefaultDashboardPermissions(ctx, key, provisioning, dashboardMeta(t, "")))

		stored, err := client.Get(context.Background(), permissionName, metav1.GetOptions{})
		require.NoError(t, err)
		permissions, _, err := unstructured.NestedSlice(stored.Object, "spec", "permissions")
		require.NoError(t, err)
		require.Equal(t, []any{
			map[string]any{"kind": "Team", "name": "team-a", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
		}, permissions, "existing grants must survive the move untouched")
	})

	t.Run("a dashboard inside a folder is left alone", func(t *testing.T) {
		b, client := newBuilder()
		ctx := apistore.WithKeepExistingPermissions(context.Background())
		require.NoError(t, b.setDefaultDashboardPermissions(ctx, key, provisioning, dashboardMeta(t, "folder-a")))

		_, err := client.Get(context.Background(), permissionName, metav1.GetOptions{})
		require.Error(t, err, "a nested dashboard inherits access and needs no record of its own")
	})
}

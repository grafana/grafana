package dashboard

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
)

func TestDashboardDefaultResourcePermissionsUseRPClient(t *testing.T) {
	gvr := iamv0.ResourcePermissionInfo.GroupVersionResource()
	gr := dashv1.DashboardResourceInfo.GroupVersionResource().GroupResource()
	newClient := func() *dynamicfake.FakeDynamicClient {
		return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{gvr: "ResourcePermissionList"})
	}
	newDashboard := func(uid, folderUID string) (*dashv1.Dashboard, utils.GrafanaMetaAccessor) {
		obj := &dashv1.Dashboard{ObjectMeta: metav1.ObjectMeta{
			Name: uid, Namespace: "org-7", Annotations: map[string]string{"grafana.app/folder": folderUID},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		return obj, meta
	}

	t.Run("writes root defaults and creator grant", func(t *testing.T) {
		dyn := newClient()
		resourceClient := dyn.Resource(gvr)
		b := &DashboardsAPIBuilder{resourcePermissions: rpclient.New(rpclient.Static(resourceClient), gr)}
		_, meta := newDashboard("dashboard-uid", "")
		id := &identity.StaticRequester{Type: types.TypeUser, UserUID: "user-123"}
		require.NoError(t, b.setDefaultDashboardPermissions(context.Background(), nil, id, meta))
		rp, err := resourceClient.Namespace("org-7").Get(context.Background(), rpclient.Name(gr, "dashboard-uid"), metav1.GetOptions{})
		require.NoError(t, err)
		permissions, found, err := unstructured.NestedSlice(rp.Object, "spec", "permissions")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, []any{
			map[string]any{"kind": "User", "name": "user-123", "verb": "admin"},
			map[string]any{"kind": "BasicRole", "name": "Editor", "verb": "edit"},
			map[string]any{"kind": "BasicRole", "name": "Viewer", "verb": "view"},
		}, permissions)
	})

	t.Run("nested dashboards and absent client do not write", func(t *testing.T) {
		dyn := newClient()
		resourceClient := dyn.Resource(gvr)
		b := &DashboardsAPIBuilder{resourcePermissions: rpclient.New(rpclient.Static(resourceClient), gr)}
		_, meta := newDashboard("dashboard-uid", "parent-folder")
		require.NoError(t, b.setDefaultDashboardPermissions(context.Background(), nil, &identity.StaticRequester{Type: types.TypeUser, UserUID: "user-123"}, meta))
		require.Empty(t, dyn.Actions())
		_, rootMeta := newDashboard("dashboard-uid", "")
		require.NoError(t, (&DashboardsAPIBuilder{}).setDefaultDashboardPermissions(context.Background(), nil, &identity.StaticRequester{}, rootMeta))
		require.Empty(t, dyn.Actions())
	})

	t.Run("after delete removes matching permissions", func(t *testing.T) {
		rpName := rpclient.Name(gr, "dashboard-uid")
		dyn := newClient()
		_, err := dyn.Resource(gvr).Namespace("org-7").Create(context.Background(), &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": iamv0.ResourcePermissionInfo.GroupVersion().String(), "kind": "ResourcePermission",
			"metadata": map[string]any{"name": rpName, "namespace": "org-7"},
		}}, metav1.CreateOptions{})
		require.NoError(t, err)
		resourceClient := dyn.Resource(gvr)
		b := &DashboardsAPIBuilder{resourcePermissions: rpclient.New(rpclient.Static(resourceClient), gr)}
		obj, _ := newDashboard("dashboard-uid", "")
		b.afterDelete(obj, &metav1.DeleteOptions{})
		_, err = resourceClient.Namespace("org-7").Get(context.Background(), rpName, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err))
	})
}

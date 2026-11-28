package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission/rpclient"
)

func TestAfterDeleteDeletesPermissions(t *testing.T) {
	const namespace, uid = "stacks-2", "ds-uid"
	permissions, dyn := newTestDatasourceResourcePermissions()
	require.NoError(t, permissions.SetDefault(t.Context(), namespace, uid, nil))
	b := &DataSourceAPIBuilder{permissionClient: permissions}

	b.afterDelete(&datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: uid}}, nil)

	resource := dyn.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource())
	rpName := rpclient.Name(datasourceV0.DataSourceResourceInfo.GroupResource(), uid)
	_, err := resource.Namespace(namespace).Get(t.Context(), rpName, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err))
}

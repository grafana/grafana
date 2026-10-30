package datasource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type recordingPermissionsDeleter struct{ calls [][2]string }

func (r *recordingPermissionsDeleter) DeleteDatasourcePermissions(_ context.Context, namespace, uid string) {
	r.calls = append(r.calls, [2]string{namespace, uid})
}

func TestAfterDeleteDeletesPermissions(t *testing.T) {
	deleter := &recordingPermissionsDeleter{}
	b := &DataSourceAPIBuilder{}
	b.SetPermissionsDeleter(deleter)

	b.afterDelete(&datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-2", Name: "ds-uid"}}, nil)

	require.Equal(t, [][2]string{{"stacks-2", "ds-uid"}}, deleter.calls)
}

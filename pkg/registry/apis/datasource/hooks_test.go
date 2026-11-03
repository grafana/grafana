package datasource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type recordingPermissionsDeleter struct{ calls [][2]string }

func (r *recordingPermissionsDeleter) DeletePermissions(_ context.Context, namespace, name string) error {
	r.calls = append(r.calls, [2]string{namespace, name})
	return nil
}

func TestAfterDeleteDeletesPermissions(t *testing.T) {
	deleter := &recordingPermissionsDeleter{}
	b := &DataSourceAPIBuilder{permissionsDeleter: deleter}

	b.afterDelete(&datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-2", Name: "ds-uid"}}, nil)

	require.Equal(t, [][2]string{{"stacks-2", "ds-uid"}}, deleter.calls)
}

package datasource

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// afterDelete runs only after unified storage deleted the datasource, including for each item of a
// collection delete. With dual writes the legacy service may also call the deleter; a repeated delete is a no-op.
func (b *DataSourceAPIBuilder) afterDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		logging.DefaultLogger.Error("Failed to access deleted datasource object metadata", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), datasources.PermissionsDeleteTimeout)
	defer cancel()
	if err := b.permissionsDeleter.DeletePermissions(ctx, meta.GetNamespace(), meta.GetName()); err != nil {
		logging.DefaultLogger.Error("Failed to delete datasource permissions", "error", err)
	}
}

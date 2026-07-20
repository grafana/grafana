package appinstaller

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

// NewDualWriter creates a dual writer for the given group resource using the provided configuration
func NewDualWriter(
	gr schema.GroupResource,
	storageOpts *options.StorageOptions,
	legacy grafanarest.Storage,
	storage grafanarest.Storage,
	dualWriteService dualwrite.Service,
	builderMetrics *builder.BuilderMetrics,
) (grafanarest.Storage, error) {
	key := gr.String()
	if resourceConfig, ok := storageOpts.UnifiedStorageConfig[key]; ok {
		builderMetrics.RecordDualWriterTargetMode(gr.Resource, gr.Group, resourceConfig.DualWriterMode)
	}

	return dualWriteService.NewStorage(gr, legacy, storage)
}

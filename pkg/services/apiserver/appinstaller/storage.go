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
	// Dashboards + Folders may be managed (depends on feature toggles and database state)
	if dualWriteService != nil && dualWriteService.ShouldManage(gr) {
		return dualWriteService.NewStorage(gr, legacy, storage) // eventually this can replace this whole function
	}

	key := gr.String() // ${resource}.{group} eg playlists.playlist.grafana.app

	// Get the option from custom.ini/command line
	// when missing this will default to mode zero (legacy only)
	var mode = grafanarest.DualWriterMode(0)

	resourceConfig, resourceExists := storageOpts.UnifiedStorageConfig[key]
	if resourceExists {
		mode = resourceConfig.DualWriterMode
	}

	builderMetrics.RecordDualWriterModes(gr.Resource, gr.Group, mode)

	switch mode {
	case grafanarest.Mode0:
		return legacy, nil
	case grafanarest.Mode4, grafanarest.Mode5:
		return storage, nil
	default:
	}

	return dualwrite.NewStaticStorage(gr, mode, legacy, storage)
}

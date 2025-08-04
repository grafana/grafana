package appinstaller

import (
	"context"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/klog/v2"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

// NewDualWriter creates a dual writer for the given group resource using the provided configuration
func NewDualWriter(
	_ context.Context,
	gr schema.GroupResource,
	storageOpts *options.StorageOptions,
	legacy grafanarest.Storage,
	storage grafanarest.Storage,
	kvStore grafanarest.NamespacedKVStore,
	lock serverLock,
	namespaceMapper request.NamespaceMapper,
	dualWriteService dualwrite.Service,
	dualWriterMetrics *grafanarest.DualWriterMetrics,
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

	var (
		dualWriterPeriodicDataSyncJobEnabled bool
		dualWriterMigrationDataSyncDisabled  bool
		dataSyncerInterval                   = time.Hour
		dataSyncerRecordsLimit               = 1000
	)

	resourceConfig, resourceExists := storageOpts.UnifiedStorageConfig[key]
	if resourceExists {
		mode = resourceConfig.DualWriterMode
		dualWriterPeriodicDataSyncJobEnabled = resourceConfig.DualWriterPeriodicDataSyncJobEnabled
		dualWriterMigrationDataSyncDisabled = resourceConfig.DualWriterMigrationDataSyncDisabled
		dataSyncerInterval = resourceConfig.DataSyncerInterval
		dataSyncerRecordsLimit = resourceConfig.DataSyncerRecordsLimit
	}

	// Force using storage only -- regardless of internal synchronization state
	if mode == grafanarest.Mode5 {
		return storage, nil
	}

	// Moving from one version to the next can only happen after the previous step has
	// successfully synchronized.
	requestInfo := getRequestInfo(gr, namespaceMapper)

	syncerCfg := &grafanarest.SyncerConfig{
		Kind:                   key,
		RequestInfo:            requestInfo,
		Mode:                   mode,
		SkipDataSync:           dualWriterMigrationDataSyncDisabled,
		LegacyStorage:          legacy,
		Storage:                storage,
		ServerLockService:      lock,
		DataSyncerInterval:     dataSyncerInterval,
		DataSyncerRecordsLimit: dataSyncerRecordsLimit,
	}

	ctx := context.Background()
	// This also sets the currentMode on the syncer config.
	currentMode, err := grafanarest.SetDualWritingMode(ctx, kvStore, syncerCfg, dualWriterMetrics)
	if err != nil {
		return nil, err
	}

	builderMetrics.RecordDualWriterModes(gr.Resource, gr.Group, mode, currentMode)

	switch currentMode {
	case grafanarest.Mode0:
		return legacy, nil
	case grafanarest.Mode4, grafanarest.Mode5:
		return storage, nil
	default:
	}

	if dualWriterPeriodicDataSyncJobEnabled {
		// The mode might have changed in SetDualWritingMode, so apply current mode first.
		syncerCfg.Mode = currentMode
		if err := grafanarest.StartPeriodicDataSyncer(ctx, syncerCfg, dualWriterMetrics); err != nil {
			return nil, err
		}
	}

	// when unable to use
	if currentMode != mode {
		klog.Warningf("Requested DualWrite mode: %d, but using %d for %+v", mode, currentMode, gr)
	}
	return dualwrite.NewDualWriter(gr, currentMode, legacy, storage)
}

func getRequestInfo(gr schema.GroupResource, namespaceMapper request.NamespaceMapper) *k8srequest.RequestInfo {
	return &k8srequest.RequestInfo{
		APIGroup:  gr.Group,
		Resource:  gr.Resource,
		Name:      "",
		Namespace: namespaceMapper(int64(1)),
	}
}

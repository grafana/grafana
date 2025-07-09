package appinstaller

import (
	"context"
	"fmt"
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

// getRequestInfo creates a RequestInfo for the given group resource using the namespace mapper
func getRequestInfo(gr schema.GroupResource, namespaceMapper request.NamespaceMapper) *k8srequest.RequestInfo {
	return &k8srequest.RequestInfo{
		APIGroup:  gr.Group,
		Resource:  gr.Resource,
		Name:      "",
		Namespace: namespaceMapper(int64(1)),
	}
}

// NewDualWriter creates a dual writer for the given group resource using the provided configuration
func NewDualWriter(
	ctx context.Context,
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
	// Check if the dual write service should manage this resource
	if dualWriteService != nil && dualWriteService.ShouldManage(gr) {
		return dualWriteService.NewStorage(gr, legacy, storage) // eventually this can replace this whole function
	}

	key := gr.String() // ${resource}.{group} eg playlists.playlist.grafana.app

	// Get the option from storage configuration
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

	// Create request info for the syncer - using the same pattern as builder
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

	// Set the dual writing mode and get the current mode
	currentMode, err := grafanarest.SetDualWritingMode(ctx, kvStore, syncerCfg, dualWriterMetrics)
	if err != nil {
		return nil, fmt.Errorf("failed to set dual writing mode for %s: %w", key, err)
	}

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
			return nil, fmt.Errorf("failed to start periodic data syncer for %s: %w", key, err)
		}
	}

	// Log warning if unable to use requested mode
	if currentMode != mode {
		klog.Warningf("Requested DualWrite mode: %d, but using %d for %+v", mode, currentMode, gr)
	}

	return dualwrite.NewDualWriter(gr, currentMode, legacy, storage)
}

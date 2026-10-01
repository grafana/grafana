package sql

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/dgraph-io/badger/v4"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// ProvideResourceDB is a Wire provider that wraps dbimpl.ProvideResourceDB
// so the resource DB can be injected into both ProvideKV and NewStorageBackend
// from the same Wire graph.
//
// Returns nil only for storage types that do not consume a SQL-backed resource
// DB (file, unified-grpc, unified-kv-grpc). All other accepted storage types
// fall through to the SQL backend in newClient and therefore require a DB
// provider.
func ProvideResourceDB(cfg *setting.Cfg, grafanaDB infraDB.DB) (db.DBProvider, error) {
	storageType := options.StorageType(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").
		MustString(string(options.StorageTypeUnified)))
	switch storageType {
	case options.StorageTypeFile, options.StorageTypeUnifiedGrpc, options.StorageTypeUnifiedKVGrpc:
		return nil, nil
	default:
		return dbimpl.ProvideResourceDB(grafanaDB, cfg, tracer)
	}
}

// ProvideExperimentalKV provides the optional experimental KV routed to
// flagged use-cases by the KV storage backend (see resource.ExperimentalKVOptions).
func ProvideExperimentalKV(cfg *setting.Cfg) (*resource.ExperimentalKVOptions, error) {
	return nil, nil
}

func ProvideModuleServerKV(cfg *setting.Cfg) (kv.KV, error) {
	return nil, nil
}

// ProvideKV provides the KV store for the resource API.
// For the SQL storage type, the SQL KV store is always initialised when the
// storage.resourceKV feature toggle is on, even if EnableSQLKVBackend is false.
// This ensures the ResourceKV gRPC service and the kv subresource work out of
// the box for feature-flag adopters who do not set the legacy ini option.
func ProvideKV(cfg *setting.Cfg, features featuremgmt.FeatureToggles, eDB db.DBProvider) (kv.KV, error) {
	storageType := options.StorageType(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").
		MustString(string(options.StorageTypeUnified)))
	switch storageType {
	case options.StorageTypeFile:
		return openBadgerKV(cfg)
	case options.StorageTypeUnified:
		if !cfg.EnableSQLKVBackend && !features.IsEnabledGlobally(featuremgmt.FlagStorageResourceKV) { //nolint:staticcheck
			return nil, nil
		}
		return openSQLKV(eDB)
	default:
		return nil, nil
	}
}

// ProvideResourceKVStoreForSearch returns a *kv.ResourceKVStore for the search
// dashboard-stats path when the storage.resourceKV toggle is on and a backing
// KV store is available. Returns nil otherwise so callers get no-op stats.
//
// Uses the same toggle-check style as the existing resource lifecycle store
// (unified/client.go makeResourceKVStore: features.IsEnabled with a
// background context) rather than IsEnabledGlobally, so the two KV-gating
// call sites read consistently.
func ProvideResourceKVStoreForSearch(features featuremgmt.FeatureToggles, kvStore kv.KV) *kv.ResourceKVStore {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if kvStore == nil || !features.IsEnabled(context.Background(), featuremgmt.FlagStorageResourceKV) {
		return nil
	}
	return kv.NewResourceKVStore(kvStore)
}

func openBadgerKV(cfg *setting.Cfg) (kv.KV, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	dataPath := apiserverCfg.Key("storage_path").
		MustString(filepath.Join(cfg.DataPath, "grafana-apiserver"))
	bdb, err := badger.Open(badger.DefaultOptions(filepath.Join(dataPath, "badger")).
		WithLogger(nil))
	if err != nil {
		return nil, fmt.Errorf("opening badger: %w", err)
	}
	return resource.NewBadgerKV(bdb), nil
}

func openSQLKV(eDB db.DBProvider) (kv.KV, error) {
	dbConn, err := eDB.Init(context.Background())
	if err != nil {
		return nil, fmt.Errorf("initializing resource DB: %w", err)
	}
	sqlkv, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	if err != nil {
		return nil, fmt.Errorf("creating sqlkv: %w", err)
	}
	return sqlkv, nil
}

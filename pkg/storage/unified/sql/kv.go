package sql

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/dgraph-io/badger/v4"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
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

func ProvideKV(cfg *setting.Cfg, eDB db.DBProvider) (kv.KV, error) {
	storageType := options.StorageType(cfg.SectionWithEnvOverrides("grafana-apiserver").Key("storage_type").
		MustString(string(options.StorageTypeUnified)))
	switch storageType {
	case options.StorageTypeFile:
		return openBadgerKV(cfg)
	case options.StorageTypeUnified:
		if !cfg.EnableSQLKVBackend {
			return nil, nil
		}
		return openSQLKV(eDB)
	default:
		return nil, nil
	}
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

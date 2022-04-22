package store

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const rootStorageTypeSQL = "sql"

type rootStorageSQL struct {
	baseStorageRuntime

	settings *StorageSQLConfig
}

func newSQLStorage(prefix string, name string, cfg *StorageSQLConfig, sql *sqlstore.SQLStore) *rootStorageSQL {
	if cfg == nil {
		cfg = &StorageSQLConfig{}
	}

	meta := RootStorageMeta{
		Config: RootStorageConfig{
			Type:   rootStorageTypeSQL,
			Prefix: prefix,
			Name:   name,
			SQL:    cfg,
		},
	}

	if prefix == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing prefix",
		})
	}

	s := &rootStorageSQL{}
	s.store = filestorage.NewDbStorage(
		grafanaStorageLogger,
		sql, nil, getDbRootFolder(prefix))

	meta.Ready = true // exists!
	s.meta = meta
	s.settings = cfg
	return s
}

func getDbRootFolder(prefix string) string {
	dbRootFolder := prefix
	if !strings.HasSuffix(dbRootFolder, filestorage.Delimiter) {
		dbRootFolder = dbRootFolder + filestorage.Delimiter
	}
	if !strings.HasPrefix(dbRootFolder, filestorage.Delimiter) {
		dbRootFolder = filestorage.Delimiter + dbRootFolder
	}
	return dbRootFolder
}

func (s *rootStorageSQL) Write(ctx context.Context, cmd *WriteValueRequest) (*WriteValueResponse, error) {
	byteAray := []byte(cmd.Body)

	path := cmd.Path
	if !strings.HasPrefix(path, filestorage.Delimiter) {
		path = filestorage.Delimiter + path
	}
	err := s.store.Upsert(ctx, &filestorage.UpsertFileCommand{
		Path:     path,
		Contents: byteAray,
	})
	if err != nil {
		return nil, err
	}
	return &WriteValueResponse{Code: 200}, nil
}

func (s *rootStorageSQL) Sync() error {
	return nil // already in sync
}

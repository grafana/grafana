package store

import (
	"context"
	"fmt"
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

// getDbRootFolder creates a DB path prefix for a given storage name and orgId.
// example:
//   orgId: 5
//   storageName: "upload"
//     => prefix: "/5/upload/"
func getDbStoragePathPrefix(orgId int64, storageName string) string {
	return filestorage.Join(fmt.Sprintf("%d", orgId), storageName+filestorage.Delimiter)
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
		sql, nil, getDbStoragePathPrefix(cfg.orgId, prefix))

	meta.Ready = true
	s.meta = meta
	s.settings = cfg
	return s
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

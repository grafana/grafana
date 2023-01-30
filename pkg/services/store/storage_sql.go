package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/filestorage"
)

const rootStorageTypeSQL = "sql"

var _ storageRuntime = &rootStorageSQL{}

type rootStorageSQL struct {
	settings *StorageSQLConfig
	meta     RootStorageMeta
	store    filestorage.FileStorage
}

// getDbRootFolder creates a DB path prefix for a given storage name and orgId.
// example:
//
//	orgId: 5
//	storageName: "upload"
//	  => prefix: "/5/upload/"
func getDbStoragePathPrefix(orgId int64, storageName string) string {
	return filestorage.Join(fmt.Sprintf("%d", orgId), storageName+filestorage.Delimiter)
}

func newSQLStorage(meta RootStorageMeta, prefix string, name string, descr string, cfg *StorageSQLConfig, sql db.DB, orgId int64, underContentRoot bool) *rootStorageSQL {
	if cfg == nil {
		cfg = &StorageSQLConfig{}
	}

	meta.Config = RootStorageConfig{
		Type:             rootStorageTypeSQL,
		Prefix:           prefix,
		Name:             name,
		Description:      descr,
		UnderContentRoot: underContentRoot,
		SQL:              cfg,
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
		sql, nil, getDbStoragePathPrefix(orgId, prefix))

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

func (s *rootStorageSQL) Meta() RootStorageMeta {
	return s.meta
}

func (s *rootStorageSQL) Store() filestorage.FileStorage {
	return s.store
}

func (s *rootStorageSQL) Sync() error {
	return nil // already in sync
}

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

func newSQLStorage(prefix string, name string, cfg *StorageSQLConfig, sql *sqlstore.SQLStore, devenv *rootStorageDisk) *rootStorageSQL {
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
	grafanaStorageLogger.Info("Loading sql storage")
	s.store = filestorage.NewDbStorage(
		grafanaStorageLogger,
		sql, nil, "/dashboards/")

	ctx := context.Background()
	if devenv != nil {
		resp, err := devenv.store.List(ctx, "/", nil, &filestorage.ListOptions{
			Recursive:   true,
			PathFilters: filestorage.NewPathFilters([]string{"/panel-"}, nil, nil, nil),
		})
		if err != nil {
			grafanaStorageLogger.Error("Failed to load files from devenv", "err", err)
		}

		grafanaStorageLogger.Info("Populating SQL storage with panel dashboards from devenv", "dashboardCount", len(resp.Files))
		for _, metadata := range resp.Files {
			f, err := devenv.store.Get(ctx, metadata.FullPath)
			if f == nil {
				fmt.Println("file nil! " + metadata.FullPath)
			}
			if err != nil {
				grafanaStorageLogger.Error("Failed to load files from devenv", "err", err)
			} else {
				grafanaStorageLogger.Info("Inserting file", "path", metadata.FullPath)
				if err := s.store.Upsert(ctx, &filestorage.UpsertFileCommand{
					Path:       metadata.FullPath,
					MimeType:   metadata.MimeType,
					Contents:   &f.Contents,
					Properties: metadata.Properties,
				}); err != nil {
					grafanaStorageLogger.Error("Failed to write file to SQL storage files from devenv", "err", err, "path", metadata.FullPath)
				}
			}
		}
	}

	meta.Ready = true // exists!
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
		Contents: &byteAray,
	})
	if err != nil {
		return nil, err
	}
	return &WriteValueResponse{Code: 200}, nil
}

func (s *rootStorageSQL) Sync() error {
	return nil // already in sync
}

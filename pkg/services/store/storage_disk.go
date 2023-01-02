package store

import (
	"context"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gocloud.dev/blob"

	"github.com/grafana/grafana/pkg/infra/filestorage"
)

const rootStorageTypeDisk = "disk"

var _ storageRuntime = &rootStorageDisk{}

type rootStorageDisk struct {
	settings *StorageLocalDiskConfig
	meta     RootStorageMeta
	store    filestorage.FileStorage
}

func newDiskStorage(meta RootStorageMeta, scfg RootStorageConfig) *rootStorageDisk {
	cfg := scfg.Disk
	if cfg == nil {
		cfg = &StorageLocalDiskConfig{}
		scfg.Disk = cfg
	}
	scfg.Type = rootStorageTypeDisk
	meta.Config = scfg
	if scfg.Prefix == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing prefix",
		})
	}
	if cfg.Path == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing path configuration",
		})
	}

	s := &rootStorageDisk{
		settings: cfg,
	}

	if meta.Notice == nil {
		protocol := "file:///"
		path := protocol + cfg.Path
		bucket, err := blob.OpenBucket(context.Background(), path)
		if err != nil {
			grafanaStorageLogger.Warn("error loading storage", "prefix", scfg.Prefix, "err", err)
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     "Failed to initialize storage",
			})
		} else {
			s.store = filestorage.NewCdkBlobStorage(grafanaStorageLogger,
				bucket, "",
				filestorage.NewPathFilter(cfg.Roots, nil, nil, nil))

			meta.Ready = true // exists!
		}
	}

	s.meta = meta
	return s
}

func (s *rootStorageDisk) Meta() RootStorageMeta {
	return s.meta
}

func (s *rootStorageDisk) Store() filestorage.FileStorage {
	return s.store
}

func (s *rootStorageDisk) Sync() error {
	return nil // already in sync
}

// with local disk user metadata and messages are lost
func (s *rootStorageDisk) Write(ctx context.Context, cmd *WriteValueRequest) (*WriteValueResponse, error) {
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

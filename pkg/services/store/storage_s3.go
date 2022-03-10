package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"gocloud.dev/blob"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const rootStorageTypeS3 = "s3"

type rootStorageS3 struct {
	baseStorageRuntime

	settings *StorageS3Config
}

func newS3Storage(prefix string, name string, cfg *StorageS3Config) *rootStorageS3 {
	if cfg == nil {
		cfg = &StorageS3Config{}
	}

	meta := RootStorageMeta{
		Config: RootStorageConfig{
			Type:   rootStorageTypeS3,
			Prefix: prefix,
			Name:   name,
			S3:     cfg,
		},
	}
	if prefix == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing prefix",
		})
	}
	if cfg.Bucket == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing bucket configuration",
		})
	}
	s := &rootStorageS3{}

	if meta.Notice == nil {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "not impemented yet...",
		})
	}

	grafanaStorageLogger.Info("Loading s3 bucket", "bucket", prefix)
	bucket, err := blob.OpenBucket(context.Background(), cfg.Bucket)
	if err != nil {
		grafanaStorageLogger.Warn("error loading storage", "bucket", cfg.Bucket, "err", err)
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Failed to initalize storage",
		})
	} else {
		s.store = filestorage.NewCdkBlobStorage(
			grafanaStorageLogger,
			bucket, cfg.Folder+filestorage.Delimiter, nil)

		meta.Ready = true // exists!
	}

	s.meta = meta
	s.settings = cfg
	return s
}

func (s *rootStorageS3) Write(ctx context.Context, cmd *writeCommand) error {
	return fmt.Errorf("not implemented!!!")
}

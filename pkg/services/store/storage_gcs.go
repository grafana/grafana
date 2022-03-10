package store

import (
	"context"
	"fmt"
	"gocloud.dev/blob/gcsblob"
	"gocloud.dev/gcp"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	_ "gocloud.dev/blob/gcsblob"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const rootStorageTypeGCS = "gcs"

type rootStorageGCS struct {
	baseStorageRuntime

	settings *StorageGCSConfig
}

func newGCSstorage(prefix string, name string, cfg *StorageGCSConfig) *rootStorageGCS {
	if cfg == nil {
		cfg = &StorageGCSConfig{}
	}

	meta := RootStorageMeta{
		Config: RootStorageConfig{
			Type:   rootStorageTypeGCS,
			Prefix: prefix,
			Name:   name,
			GCS:    cfg,
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
	s := &rootStorageGCS{}

	if meta.Notice == nil {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "not implemented yet...",
		})
	}
	ctx := context.Background()

	creds, err := transport.Creds(ctx, option.WithCredentialsFile("/home/artur/.gcs/service-account.json"), option.WithScopes("https://www.googleapis.com/auth/devstorage.read_only"))
	if err != nil {
		grafanaStorageLogger.Warn("error loading storage - failed to load creds", "bucket", cfg.Bucket, "err", err)
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Failed to initalize storage",
		})
		return s
	}
	client, err := gcp.NewHTTPClient(
		gcp.DefaultTransport(),
		gcp.CredentialsTokenSource(creds))

	if err != nil {
		grafanaStorageLogger.Warn("error loading storage - failed to create http client", "bucket", cfg.Bucket, "err", err)
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Failed to initalize storage",
		})
		return s
	}

	grafanaStorageLogger.Info("Loading gcs bucket", "bucket", cfg.Bucket)
	bucket, err := gcsblob.OpenBucket(context.Background(), client, strings.TrimPrefix(cfg.Bucket, "gs://"), nil)
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

func (s *rootStorageGCS) Write(ctx context.Context, cmd *writeCommand) error {
	return fmt.Errorf("not implemented!!!")
}

package store

import (
	"context"
	"fmt"
	"os"
	"strings"

	"gocloud.dev/blob/gcsblob"
	"gocloud.dev/gcp"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"

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

	credentialsFilePath := cfg.CredentialsFile
	if strings.HasPrefix(credentialsFilePath, "$") {
		credentialsFilePath = os.Getenv(credentialsFilePath[1:])
		if credentialsFilePath == "" {
			grafanaStorageLogger.Warn("error loading gcs storage - no credentials file path", "bucket", cfg.Bucket)
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     "Unable to find token environment variable: " + credentialsFilePath,
			})
			return s
		}
	}
	creds, err := transport.Creds(ctx,
		option.WithCredentialsFile(credentialsFilePath),
		option.WithScopes("https://www.googleapis.com/auth/devstorage.read_only"),
	)
	if err != nil {
		grafanaStorageLogger.Warn("error loading gcs storage - failed to load creds", "bucket", cfg.Bucket, "err", err)
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
		grafanaStorageLogger.Warn("error loading gcs storage - failed to create http client", "bucket", cfg.Bucket, "err", err)
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Failed to initalize storage",
		})
		return s
	}

	grafanaStorageLogger.Info("Loading gcs bucket", "bucket", cfg.Bucket)
	bucket, err := gcsblob.OpenBucket(context.Background(), client, cfg.Bucket, nil)
	if err != nil {
		grafanaStorageLogger.Warn("error loading gcs storage", "bucket", cfg.Bucket, "err", err)
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

func (s *rootStorageGCS) Write(ctx context.Context, cmd *WriteValueRequest) (*WriteValueResponse, error) {
	return nil, fmt.Errorf("not implemented!!!")
}

package store

import (
	"context"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"gocloud.dev/blob/s3blob"

	"github.com/grafana/grafana/pkg/infra/filestorage"

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

	accessKey := cfg.AccessKey
	if strings.HasPrefix(accessKey, "$") {
		accessKey = os.Getenv(accessKey[1:])
		if accessKey == "" {
			grafanaStorageLogger.Warn("error loading s3 storage - no access key", "bucket", cfg.Bucket)
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     "Unable to find token environment variable: " + accessKey,
			})
			s.meta = meta
			return s
		}
	}

	secretKey := cfg.SecretKey
	if strings.HasPrefix(secretKey, "$") {
		secretKey = os.Getenv(secretKey[1:])
		if secretKey == "" {
			grafanaStorageLogger.Warn("error loading s3 storage - no secret key", "bucket", cfg.Bucket)
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     "Unable to find token environment variable: " + secretKey,
			})
			s.meta = meta
			return s
		}
	}

	region := cfg.Region
	if strings.HasPrefix(region, "$") {
		region = os.Getenv(region[1:])
		if region == "" {
			grafanaStorageLogger.Warn("error loading s3 storage - no region", "bucket", cfg.Bucket)
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     "Unable to find token environment variable: " + region,
			})
			s.meta = meta
			return s
		}
	}

	sess := session.Must(session.NewSession(&aws.Config{
		Region:      aws.String(region),
		Credentials: credentials.NewStaticCredentials(accessKey, secretKey, ""),
	}))

	grafanaStorageLogger.Info("Loading s3 bucket", "bucket", cfg.Bucket)
	bucket, err := s3blob.OpenBucket(context.Background(), sess, cfg.Bucket, nil)
	if err != nil {
		grafanaStorageLogger.Warn("error loading storage", "bucket", cfg.Bucket, "err", err)
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Failed to initialize storage",
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

func (s *rootStorageS3) Write(ctx context.Context, cmd *WriteValueRequest) (*WriteValueResponse, error) {
	return &WriteValueResponse{
		Code:    500,
		Message: "unsupportted operation (S3)",
	}, nil
}

func (s *rootStorageS3) Sync() error {
	return nil
}

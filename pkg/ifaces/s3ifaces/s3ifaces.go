// Package s3ifaces provides interfaces for AWS S3.
//
//go:generate mockgen -source $GOFILE -destination ../../mocks/mock_s3ifaces/mocks.go S3Client
package s3ifaces

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Client wraps the S3 operations needed by the image uploader.
type S3Client interface {
	Upload(ctx context.Context, input *s3.PutObjectInput) (*manager.UploadOutput, error)
	PresignGetObject(ctx context.Context, bucket, key string, expiration time.Duration) (string, error)
}

// Package s3ifaces provides interfaces for AWS S3.
//
//go:generate mockgen -source $GOFILE -destination ../../mocks/mock_s3ifaces/mocks.go S3Client
package s3ifaces

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go/service/s3/s3manager"
)

// S3Client wraps the S3 operations needed by the image uploader.
type S3Client interface {
	Upload(ctx context.Context, input *s3manager.UploadInput) (*s3manager.UploadOutput, error)
	PresignGetObject(bucket, key string, expiration time.Duration) (string, error)
}

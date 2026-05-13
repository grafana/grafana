package imguploader

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana/pkg/ifaces/s3ifaces"
	"github.com/grafana/grafana/pkg/mocks/mock_s3ifaces"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUploadToS3(t *testing.T) {
	t.Run("[Integration test] for external_image_store.s3", func(t *testing.T) {
		t.Skip("Skip test [Integration test] for external_image_store.s3")
		cfg := setting.NewCfg()
		err := cfg.Load(setting.CommandLineArgs{
			HomePath: "../../../",
		})
		require.NoError(t, err)

		s3Uploader, err := NewImageUploader(cfg)
		require.NoError(t, err)

		path, err := s3Uploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")
		require.NoError(t, err)
		require.NotEqual(t, "", path)
	})
}

func stubS3Client(t *testing.T, mock s3ifaces.S3Client) {
	t.Helper()
	orig := newS3Client
	t.Cleanup(func() { newS3Client = orig })
	newS3Client = func(_ *aws.Config) (s3ifaces.S3Client, error) {
		return mock, nil
	}
}

func TestS3Upload(t *testing.T) {
	const (
		bucket    = "test-bucket"
		region    = "us-east-1"
		imgPath   = "images/"
		publicURL = "https://test-bucket.s3.amazonaws.com/images/test.png"
	)

	tmpDir := t.TempDir()
	fpath := filepath.Join(tmpDir, "test.png")
	require.NoError(t, os.WriteFile(fpath, []byte("fake png"), 0600))

	t.Run("without presigned URLs sets ACL and returns location", func(t *testing.T) {
		ctx := context.Background()
		ctrl := gomock.NewController(t)

		m := mock_s3ifaces.NewMockS3Client(ctrl)
		m.EXPECT().
			Upload(gomock.Eq(ctx), gomock.Any()).
			DoAndReturn(func(_ context.Context, input *s3manager.UploadInput) (*s3manager.UploadOutput, error) {
				assert.Equal(t, bucket, aws.StringValue(input.Bucket))
				assert.Equal(t, "image/png", aws.StringValue(input.ContentType))
				assert.NotNil(t, input.ACL, "ACL should be set when presigned URLs are disabled")
				assert.Equal(t, "public-read", aws.StringValue(input.ACL))
				return &s3manager.UploadOutput{Location: publicURL}, nil
			})

		stubS3Client(t, m)

		uploader := NewS3Uploader(S3UploaderOptions{
			Region:              region,
			Bucket:              bucket,
			Path:                imgPath,
			ACL:                 "public-read",
			EnablePresignedURLs: false,
		})

		url, err := uploader.Upload(ctx, fpath)
		require.NoError(t, err)
		assert.Equal(t, publicURL, url)
	})

	t.Run("with presigned URLs omits ACL and returns presigned URL", func(t *testing.T) {
		ctx := context.Background()
		ctrl := gomock.NewController(t)

		const presignedURL = "https://test-bucket.s3.amazonaws.com/images/abc.png?X-Amz-Signature=sig"
		expiration := 48 * time.Hour

		m := mock_s3ifaces.NewMockS3Client(ctrl)
		m.EXPECT().
			Upload(gomock.Eq(ctx), gomock.Any()).
			DoAndReturn(func(_ context.Context, input *s3manager.UploadInput) (*s3manager.UploadOutput, error) {
				assert.Equal(t, bucket, aws.StringValue(input.Bucket))
				assert.Nil(t, input.ACL, "ACL should not be set when presigned URLs are enabled")
				return &s3manager.UploadOutput{Location: publicURL}, nil
			})
		m.EXPECT().
			PresignGetObject(gomock.Eq(bucket), gomock.Any(), gomock.Eq(expiration)).
			Return(presignedURL, nil)

		stubS3Client(t, m)

		uploader := NewS3Uploader(S3UploaderOptions{
			Region:                 region,
			Bucket:                 bucket,
			Path:                   imgPath,
			ACL:                    "public-read",
			EnablePresignedURLs:    true,
			PresignedURLExpiration: expiration,
		})

		url, err := uploader.Upload(ctx, fpath)
		require.NoError(t, err)
		assert.Equal(t, presignedURL, url)
	})
}

package imguploader

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
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

func TestNewS3Uploader(t *testing.T) {
	t.Run("creates uploader with presigned URLs disabled", func(t *testing.T) {
		uploader := NewS3Uploader("endpoint", "us-east-1", "bucket", "path/", "public-read",
			"ak", "sk", false, false, 7*24*time.Hour)

		require.Equal(t, "endpoint", uploader.endpoint)
		require.Equal(t, "us-east-1", uploader.region)
		require.Equal(t, "bucket", uploader.bucket)
		require.Equal(t, "path/", uploader.path)
		require.Equal(t, "public-read", uploader.acl)
		require.Equal(t, "ak", uploader.accessKey)
		require.Equal(t, "sk", uploader.secretKey)
		require.False(t, uploader.pathStyleAccess)
		require.False(t, uploader.enablePresignedURLs)
		require.Equal(t, 7*24*time.Hour, uploader.presignedURLExpiration)
	})

	t.Run("creates uploader with presigned URLs enabled", func(t *testing.T) {
		uploader := NewS3Uploader("", "eu-west-1", "my-bucket", "images/", "private",
			"", "", true, true, 48*time.Hour)

		require.Equal(t, "eu-west-1", uploader.region)
		require.Equal(t, "my-bucket", uploader.bucket)
		require.Equal(t, "private", uploader.acl)
		require.True(t, uploader.pathStyleAccess)
		require.True(t, uploader.enablePresignedURLs)
		require.Equal(t, 48*time.Hour, uploader.presignedURLExpiration)
	})
}


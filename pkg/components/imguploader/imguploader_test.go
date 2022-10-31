package imguploader

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/imguploader/gcs"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestImageUploaderFactory(t *testing.T) {
	t.Run("Can create image uploader for ", func(t *testing.T) {
		t.Run("S3ImageUploader config", func(t *testing.T) {
			cfg := setting.NewCfg()
			err := cfg.Load(setting.CommandLineArgs{
				HomePath: "../../../",
			})
			require.NoError(t, err)

			setting.ImageUploadProvider = "s3"

			t.Run("with bucket url https://foo.bar.baz.s3-us-east-2.amazonaws.com", func(t *testing.T) {
				s3sec, err := setting.Raw.GetSection("external_image_storage.s3")
				require.NoError(t, err)
				_, err = s3sec.NewKey("bucket_url", "https://foo.bar.baz.s3-us-east-2.amazonaws.com")
				require.NoError(t, err)
				_, err = s3sec.NewKey("access_key", "access_key")
				require.NoError(t, err)
				_, err = s3sec.NewKey("secret_key", "secret_key")
				require.NoError(t, err)

				uploader, err := NewImageUploader()
				require.NoError(t, err)

				original, ok := uploader.(*S3Uploader)
				require.True(t, ok)
				require.Equal(t, "us-east-2", original.region)
				require.Equal(t, "foo.bar.baz", original.bucket)
				require.Equal(t, "access_key", original.accessKey)
				require.Equal(t, "secret_key", original.secretKey)
			})

			t.Run("with bucket url https://s3.amazonaws.com/mybucket", func(t *testing.T) {
				s3sec, err := setting.Raw.GetSection("external_image_storage.s3")
				require.NoError(t, err)
				_, err = s3sec.NewKey("bucket_url", "https://s3.amazonaws.com/my.bucket.com")
				require.NoError(t, err)
				_, err = s3sec.NewKey("access_key", "access_key")
				require.NoError(t, err)
				_, err = s3sec.NewKey("secret_key", "secret_key")
				require.NoError(t, err)

				uploader, err := NewImageUploader()
				require.NoError(t, err)

				original, ok := uploader.(*S3Uploader)
				require.True(t, ok)
				require.Equal(t, "us-east-1", original.region)
				require.Equal(t, "my.bucket.com", original.bucket)
				require.Equal(t, "access_key", original.accessKey)
				require.Equal(t, "secret_key", original.secretKey)
			})

			t.Run("with bucket url https://s3-us-west-2.amazonaws.com/mybucket", func(t *testing.T) {
				s3sec, err := setting.Raw.GetSection("external_image_storage.s3")
				require.NoError(t, err)
				_, err = s3sec.NewKey("bucket_url", "https://s3-us-west-2.amazonaws.com/my.bucket.com")
				require.NoError(t, err)
				_, err = s3sec.NewKey("access_key", "access_key")
				require.NoError(t, err)
				_, err = s3sec.NewKey("secret_key", "secret_key")
				require.NoError(t, err)

				uploader, err := NewImageUploader()
				require.NoError(t, err)

				original, ok := uploader.(*S3Uploader)
				require.True(t, ok)
				require.Equal(t, "us-west-2", original.region)
				require.Equal(t, "my.bucket.com", original.bucket)
				require.Equal(t, "access_key", original.accessKey)
				require.Equal(t, "secret_key", original.secretKey)
			})
		})

		t.Run("Webdav uploader", func(t *testing.T) {
			cfg := setting.NewCfg()
			err := cfg.Load(setting.CommandLineArgs{
				HomePath: "../../../",
			})
			require.NoError(t, err)

			setting.ImageUploadProvider = "webdav"

			webdavSec, err := cfg.Raw.GetSection("external_image_storage.webdav")
			require.NoError(t, err)
			_, err = webdavSec.NewKey("url", "webdavUrl")
			require.NoError(t, err)
			_, err = webdavSec.NewKey("username", "username")
			require.NoError(t, err)
			_, err = webdavSec.NewKey("password", "password")
			require.NoError(t, err)

			uploader, err := NewImageUploader()
			require.NoError(t, err)
			original, ok := uploader.(*WebdavUploader)

			require.True(t, ok)
			require.Equal(t, "webdavUrl", original.url)
			require.Equal(t, "username", original.username)
			require.Equal(t, "password", original.password)
		})

		t.Run("GCS uploader", func(t *testing.T) {
			cfg := setting.NewCfg()
			err := cfg.Load(setting.CommandLineArgs{
				HomePath: "../../../",
			})
			require.NoError(t, err)

			setting.ImageUploadProvider = "gcs"

			gcpSec, err := cfg.Raw.GetSection("external_image_storage.gcs")
			require.NoError(t, err)
			_, err = gcpSec.NewKey("key_file", "/etc/secrets/project-79a52befa3f6.json")
			require.NoError(t, err)
			_, err = gcpSec.NewKey("bucket", "project-grafana-east")
			require.NoError(t, err)

			uploader, err := NewImageUploader()
			require.NoError(t, err)

			original, ok := uploader.(*gcs.Uploader)
			require.True(t, ok)
			require.Equal(t, "/etc/secrets/project-79a52befa3f6.json", original.KeyFile)
			require.Equal(t, "project-grafana-east", original.Bucket)
		})

		t.Run("AzureBlobUploader config", func(t *testing.T) {
			cfg := setting.NewCfg()
			err := cfg.Load(setting.CommandLineArgs{
				HomePath: "../../../",
			})
			require.NoError(t, err)

			setting.ImageUploadProvider = "azure_blob"

			t.Run("with container name", func(t *testing.T) {
				azureBlobSec, err := cfg.Raw.GetSection("external_image_storage.azure_blob")
				require.NoError(t, err)
				_, err = azureBlobSec.NewKey("account_name", "account_name")
				require.NoError(t, err)
				_, err = azureBlobSec.NewKey("account_key", "account_key")
				require.NoError(t, err)
				_, err = azureBlobSec.NewKey("container_name", "container_name")
				require.NoError(t, err)
				_, err = azureBlobSec.NewKey("sas_token_expiration_days", "sas_token_expiration_days")
				require.NoError(t, err)

				uploader, err := NewImageUploader()
				require.NoError(t, err)

				original, ok := uploader.(*AzureBlobUploader)
				require.True(t, ok)
				require.Equal(t, "account_name", original.account_name)
				require.Equal(t, "account_key", original.account_key)
				require.Equal(t, "container_name", original.container_name)
				require.Equal(t, -1, original.sas_token_expiration_days)
			})
		})

		t.Run("Local uploader", func(t *testing.T) {
			cfg := setting.NewCfg()
			err := cfg.Load(setting.CommandLineArgs{
				HomePath: "../../../",
			})
			require.NoError(t, err)

			setting.ImageUploadProvider = "local"

			uploader, err := NewImageUploader()
			require.NoError(t, err)

			original, ok := uploader.(*LocalUploader)
			require.True(t, ok)
			require.NotNil(t, original)
		})
	})
}

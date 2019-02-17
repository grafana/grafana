package imguploader

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestImageUploaderFactory(t *testing.T) {
	Convey("Can create image uploader for ", t, func() {
		Convey("S3ImageUploader config", func() {
			cfg := setting.NewCfg()
			cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "s3"

			Convey("with bucket url https://foo.bar.baz.s3-us-east-2.amazonaws.com", func() {
				s3sec, err := setting.Raw.GetSection("external_image_storage.s3")
				So(err, ShouldBeNil)
				s3sec.NewKey("bucket_url", "https://foo.bar.baz.s3-us-east-2.amazonaws.com")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "us-east-2")
				So(original.bucket, ShouldEqual, "foo.bar.baz")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})

			Convey("with bucket url https://s3.amazonaws.com/mybucket", func() {
				s3sec, err := setting.Raw.GetSection("external_image_storage.s3")
				So(err, ShouldBeNil)
				s3sec.NewKey("bucket_url", "https://s3.amazonaws.com/my.bucket.com")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "us-east-1")
				So(original.bucket, ShouldEqual, "my.bucket.com")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})

			Convey("with bucket url https://s3-us-west-2.amazonaws.com/mybucket", func() {
				s3sec, err := setting.Raw.GetSection("external_image_storage.s3")
				So(err, ShouldBeNil)
				s3sec.NewKey("bucket_url", "https://s3-us-west-2.amazonaws.com/my.bucket.com")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")

				uploader, err := NewImageUploader()
				So(err, ShouldBeNil)

				original, ok := uploader.(*S3Uploader)
				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "us-west-2")
				So(original.bucket, ShouldEqual, "my.bucket.com")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})
		})

		Convey("Webdav uploader", func() {
			var err error

			cfg := setting.NewCfg()
			cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "webdav"

			webdavSec, err := cfg.Raw.GetSection("external_image_storage.webdav")
			So(err, ShouldBeNil)
			webdavSec.NewKey("url", "webdavUrl")
			webdavSec.NewKey("username", "username")
			webdavSec.NewKey("password", "password")

			uploader, err := NewImageUploader()

			So(err, ShouldBeNil)
			original, ok := uploader.(*WebdavUploader)

			So(ok, ShouldBeTrue)
			So(original.url, ShouldEqual, "webdavUrl")
			So(original.username, ShouldEqual, "username")
			So(original.password, ShouldEqual, "password")
		})

		Convey("GCS uploader", func() {
			var err error

			cfg := setting.NewCfg()
			cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "gcs"

			gcpSec, err := cfg.Raw.GetSection("external_image_storage.gcs")
			So(err, ShouldBeNil)
			gcpSec.NewKey("key_file", "/etc/secrets/project-79a52befa3f6.json")
			gcpSec.NewKey("bucket", "project-grafana-east")

			uploader, err := NewImageUploader()
			So(err, ShouldBeNil)

			original, ok := uploader.(*GCSUploader)
			So(ok, ShouldBeTrue)
			So(original.keyFile, ShouldEqual, "/etc/secrets/project-79a52befa3f6.json")
			So(original.bucket, ShouldEqual, "project-grafana-east")
		})

		Convey("AzureBlobUploader config", func() {
			cfg := setting.NewCfg()
			cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})
			setting.ImageUploadProvider = "azure_blob"

			Convey("with container name", func() {
				azureBlobSec, err := cfg.Raw.GetSection("external_image_storage.azure_blob")
				So(err, ShouldBeNil)
				azureBlobSec.NewKey("account_name", "account_name")
				azureBlobSec.NewKey("account_key", "account_key")
				azureBlobSec.NewKey("container_name", "container_name")

				uploader, err := NewImageUploader()
				So(err, ShouldBeNil)

				original, ok := uploader.(*AzureBlobUploader)
				So(ok, ShouldBeTrue)
				So(original.account_name, ShouldEqual, "account_name")
				So(original.account_key, ShouldEqual, "account_key")
				So(original.container_name, ShouldEqual, "container_name")
			})
		})

		Convey("Local uploader", func() {
			var err error

			cfg := setting.NewCfg()
			cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "local"

			uploader, err := NewImageUploader()

			So(err, ShouldBeNil)
			original, ok := uploader.(*LocalUploader)

			So(ok, ShouldBeTrue)
			So(original, ShouldNotBeNil)
		})
	})
}

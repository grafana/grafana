package imguploader

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestImageUploaderFactory(t *testing.T) {
	Convey("Can create image uploader for ", t, func() {
		Convey("S3ImageUploader", func() {
			Convey("with amazonawsbucket_url", func() {
				var err error
				setting.NewConfigContext(&setting.CommandLineArgs{
					HomePath: "../../../",
				})

				setting.ImageUploadProvider = "s3"

				s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
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

			Convey("with custom s3 provider", func() {
				var err error
				setting.NewConfigContext(&setting.CommandLineArgs{
					HomePath: "../../../",
				})

				setting.ImageUploadProvider = "s3"

				s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
				s3sec.NewKey("bucket_url", "https://bucket1234.hb.cldmail.ru")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")
				s3sec.NewKey("region", "ru-msk")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "ru-msk")
				So(original.bucket, ShouldEqual, "bucket1234")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})

			Convey("with bucket in path", func() {
				var err error
				setting.NewConfigContext(&setting.CommandLineArgs{
					HomePath: "../../../",
				})

				setting.ImageUploadProvider = "s3"

				s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
				s3sec.NewKey("bucket_url", "https://hb.cldmail.ru/bucket1234")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")
				s3sec.NewKey("region", "ru-msk")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "ru-msk")
				So(original.bucket, ShouldEqual, "bucket1234")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})

			Convey("with ceph configs", func() {
				var err error
				setting.NewConfigContext(&setting.CommandLineArgs{
					HomePath: "../../../",
				})

				setting.ImageUploadProvider = "s3"

				s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
				s3sec.NewKey("bucket_url", "https://grafana.s3.ceph.cluster")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")
				s3sec.NewKey("endpoint", "s3.ceph.cluster")
				s3sec.NewKey("public_url", "https://grafana.my.domain.com")
				s3sec.NewKey("disable_ssl", "true")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "us-east-1")
				So(original.bucket, ShouldEqual, "grafana")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
				So(original.endpoint, ShouldEqual, "https://s3.ceph.cluster")
				So(original.publicUrl, ShouldEqual, "https://grafana.my.domain.com")
				So(original.disableSsl, ShouldEqual, true)
			})
		})

		Convey("Webdav uploader", func() {
			var err error

			setting.NewConfigContext(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "webdav"

			webdavSec, err := setting.Cfg.GetSection("external_image_storage.webdav")
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
	})
}

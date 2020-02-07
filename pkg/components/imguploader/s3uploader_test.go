package imguploader

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToS3(t *testing.T) {
	SkipConvey("[Integration test] for external_image_store.s3", t, func() {
		cfg := setting.NewCfg()
		err := cfg.Load(&setting.CommandLineArgs{
			HomePath: "../../../",
		})
		So(err, ShouldBeNil)

		s3Uploader, err := NewImageUploader()
		So(err, ShouldBeNil)

		path, err := s3Uploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")
		So(err, ShouldBeNil)
		So(path, ShouldNotEqual, "")
	})
}

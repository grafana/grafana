package imguploader

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToMINIO(t *testing.T) {
	SkipConvey("[Integration test] for external_image_store.minio", t, func() {
		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})

		minioUploader, _ := NewImageUploader()

		path, err := minioUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldNotEqual, "")
	})
}

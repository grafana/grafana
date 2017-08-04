package imguploader

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToGCP(t *testing.T) {
	SkipConvey("[Integration test] for external_image_store.gcp", t, func() {
		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})

		gcpUploader, _ := NewImageUploader()

		path, err := gcpUploader.Upload("../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldNotEqual, "")
	})
}

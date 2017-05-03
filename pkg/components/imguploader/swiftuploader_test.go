package imguploader

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToSwift(t *testing.T) {
	SkipConvey("[Integration test] for external_image_store.swift", t, func() {
		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})
		setting.ImageUploadProvider = "swift"
		swiftsec, err := setting.Cfg.GetSection("external_image_storage.swift")
		swiftsec.NewKey("authEndpoint", os.Getenv("OS_AUTH_URL"))
		swiftsec.NewKey("region", os.Getenv("OS_REGION_NAME"))
		swiftsec.NewKey("username", os.Getenv("OS_USERNAME"))
		swiftsec.NewKey("password", os.Getenv("OS_PASSWORD"))
		swiftsec.NewKey("tenantName", os.Getenv("OS_TENANT_NAME"))
		swiftsec.NewKey("container", "swift_test")

		swiftUploader, err := NewImageUploader()
		if err != nil {
			t.Error(err)
			t.Fail()
		}

		path, err := swiftUploader.Upload("../../../public/img/logo_transparent_400x.png")
		So(err, ShouldBeNil)
		So(path, ShouldNotEqual, "")
	})
}

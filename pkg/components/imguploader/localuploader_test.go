package imguploader

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToLocal(t *testing.T) {
	Convey("[Integration test] for external_image_store.local", t, func() {
		localUploader, _ := NewLocalImageUploader()
		path, err := localUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldContainSubstring, "/public/img/attachments")
	})
}

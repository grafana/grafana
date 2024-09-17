package imguploader

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUploadToLocal(t *testing.T) {
	t.Run("[Integration test] for external_image_store.local", func(t *testing.T) {
		localUploader, _ := NewLocalImageUploader()
		path, err := localUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		require.NoError(t, err)
		require.Contains(t, path, "/public/img/attachments")
	})
}

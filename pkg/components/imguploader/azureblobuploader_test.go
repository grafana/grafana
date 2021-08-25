package imguploader

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestUploadToAzureBlob(t *testing.T) {
	t.Run("[Integration test] for external_image_store.azure_blob", func(t *testing.T) {
		t.Skip("Skipping testing for external_image_store.azure_blob")
		cfg := setting.NewCfg()

		err := cfg.Load(setting.CommandLineArgs{
			HomePath: "../../../",
		})
		require.NoError(t, err)

		uploader, _ := NewImageUploader()

		path, err := uploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		require.NoError(t, err)
		require.NotEqual(t, "", path)
	})
}

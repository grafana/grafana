package imguploader

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestUploadToS3(t *testing.T) {
	t.Run("[Integration test] for external_image_store.s3", func(t *testing.T) {
		t.Skip("Skip test [Integration test] for external_image_store.s3")
		cfg := setting.NewCfg()
		err := cfg.Load(setting.CommandLineArgs{
			HomePath: "../../../",
		})
		require.NoError(t, err)

		s3Uploader, err := NewImageUploader()
		require.NoError(t, err)

		path, err := s3Uploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")
		require.NoError(t, err)
		require.NotEqual(t, "", path)
	})
}

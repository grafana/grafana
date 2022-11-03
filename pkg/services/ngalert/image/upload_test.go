package image

import (
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestUploadingService(t *testing.T) {
	c := gomock.NewController(t)
	defer c.Finish()

	u := imguploader.NewMockImageUploader(c)
	s := NewUploadingService(u, prometheus.NewRegistry())

	ctx := context.Background()

	u.EXPECT().Upload(ctx, "foo.png").Return("https://example.com/foo.png", nil)
	image, err := s.Upload(ctx, models.Image{Path: "foo.png"})
	require.NoError(t, err)
	assert.Equal(t, models.Image{
		Path: "foo.png",
		URL:  "https://example.com/foo.png",
	}, image)

	// error on upload should still return screenshot on disk
	u.EXPECT().Upload(ctx, "foo.png").Return("", errors.New("service is unavailable"))
	image, err = s.Upload(ctx, models.Image{Path: "foo.png"})
	assert.EqualError(t, err, "failed to upload screenshot: service is unavailable")
	assert.Equal(t, models.Image{
		Path: "foo.png",
	}, image)
}

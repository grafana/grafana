package v2

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseRequestRepresentsFullHeightImages(t *testing.T) {
	request, err := ParseRequest(RequestInput{
		RenderType:  RenderPNG,
		Path:        "d/example/dashboard",
		Timeout:     time.Second,
		Width:       1024,
		Height:      -1,
		DeviceScale: 1,
	})
	require.NoError(t, err)
	require.True(t, request.height.full)

	for _, height := range []int{0, -2} {
		_, err := ParseRequest(RequestInput{
			RenderType:  RenderPNG,
			Path:        "d/example/dashboard",
			Timeout:     time.Second,
			Width:       1024,
			Height:      height,
			DeviceScale: 1,
		})
		require.ErrorContains(t, err, "image dimensions")
	}
}

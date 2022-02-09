package pushurl

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFrameFormatFromValues(t *testing.T) {
	values := url.Values{}
	require.Equal(t, "labels_column", FrameFormatFromValues(values))
	values.Set(frameFormatParam, "wide")
	require.Equal(t, "wide", FrameFormatFromValues(values))
}

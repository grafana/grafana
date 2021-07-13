package pushurl

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/services/live/telemetry/telegraf"

	"github.com/stretchr/testify/require"
)

func TestFrameFormatFromValues(t *testing.T) {
	values := url.Values{}
	ff, err := FrameFormatFromValues(values)
	require.NoError(t, err)
	require.Equal(t, telegraf.FrameTypeLabelsColumn, ff)
	values.Set(frameFormatParam, "wide")
	ff, err = FrameFormatFromValues(values)
	require.NoError(t, err)
	require.Equal(t, telegraf.FrameTypeWide, ff)
}

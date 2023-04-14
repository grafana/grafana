package pipeline

import (
	"context"
	"flag"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

var update = flag.Bool("update", true, "update golden files")

func loadTestJson(t testing.TB, file string) []byte {
	t.Helper()
	// Safe to disable, this is a test.
	// nolint:gosec
	content, err := os.ReadFile(filepath.Join("testdata", file+".json"))
	require.NoError(t, err, "expected to be able to read file")
	require.True(t, len(content) > 0)
	return content
}

func checkAutoConversion(t *testing.T, file string) *backend.DataResponse {
	t.Helper()
	content := loadTestJson(t, file)

	converter := NewAutoJsonConverter(AutoJsonConverterConfig{})
	converter.nowTimeFunc = func() time.Time {
		return time.Date(2021, 01, 01, 12, 12, 12, 0, time.UTC)
	}
	channelFrames, err := converter.Convert(context.Background(), Vars{}, content)
	require.NoError(t, err)

	dr := &backend.DataResponse{}
	for _, cf := range channelFrames {
		require.Empty(t, cf.Channel)
		dr.Frames = append(dr.Frames, cf.Frame)
	}

	experimental.CheckGoldenJSONResponse(t, "testdata", file+".golden", dr, *update)
	return dr
}

func TestAutoJsonConverter_Convert(t *testing.T) {
	checkAutoConversion(t, "json_auto")
}

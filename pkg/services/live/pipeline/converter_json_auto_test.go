package pipeline

import (
	"context"
	"flag"
	"io/ioutil"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

var update = flag.Bool("update", false, "update golden files")

func loadTestJson(tb testing.TB, file string) []byte {
	tb.Helper()
	// Safe to disable, this is a test.
	// nolint:gosec
	content, err := ioutil.ReadFile(filepath.Join("testdata", file+".json"))
	require.NoError(tb, err, "expected to be able to read file")
	require.True(tb, len(content) > 0)
	return content
}

func checkAutoConversion(tb testing.TB, file string) *backend.DataResponse {
	tb.Helper()
	content := loadTestJson(tb, file)

	converter := NewAutoJsonConverter(AutoJsonConverterConfig{})
	converter.nowTimeFunc = func() time.Time {
		return time.Date(2021, 01, 01, 12, 12, 12, 0, time.UTC)
	}
	channelFrames, err := converter.Convert(context.Background(), Vars{}, content)
	require.NoError(tb, err)

	dr := &backend.DataResponse{}
	for _, cf := range channelFrames {
		require.Empty(tb, cf.Channel)
		dr.Frames = append(dr.Frames, cf.Frame)
	}

	err = experimental.CheckGoldenDataResponse(filepath.Join("testdata", file+".golden.txt"), dr, *update)
	require.NoError(tb, err)
	return dr
}

func TestAutoJsonConverter_Convert(t *testing.T) {
	checkAutoConversion(t, "json_auto")
}

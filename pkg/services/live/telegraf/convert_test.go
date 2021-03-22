package telegraf

import (
	"io/ioutil"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func loadTestData(tb testing.TB, file string) []byte {
	content, err := ioutil.ReadFile(filepath.Join("testdata", file+".txt"))
	require.NoError(tb, err, "expected to be able to read file")
	require.True(tb, len(content) > 0)
	return content
}

func TestMetricConverter_Convert(t *testing.T) {
	testCases := []struct {
		Name       string
		NumMetrics int
		NumFrames  int
	}{
		{Name: "single_metric", NumMetrics: 1, NumFrames: 1},
		{Name: "same_metrics_same_labels_different_time", NumMetrics: 2, NumFrames: 2},
		{Name: "same_metrics_different_labels_different_time", NumMetrics: 2, NumFrames: 2},
		{Name: "same_metrics_different_labels_same_time", NumMetrics: 13, NumFrames: 1},
	}

	for _, tt := range testCases {
		t.Run(tt.Name, func(t *testing.T) {
			testData := loadTestData(t, "single_metric")
			parser := NewInfluxParser()
			metrics, err := parser.Parse(testData)
			require.NoError(t, err)
			require.Len(t, metrics, 1)
			metricFrames, err := NewMetricConverter().Convert(metrics)
			require.NoError(t, err)
			require.Len(t, metricFrames, 1)
			for _, mf := range metricFrames {
				_, err := data.FrameToJSON(mf.Frame(), true, true)
				require.NoError(t, err)
			}
		})
	}
}

func TestMetricConverter_Convert_NumFrameFields(t *testing.T) {
	testData := loadTestData(t, "same_metrics_different_labels_same_time")
	parser := NewInfluxParser()
	metrics, err := parser.Parse(testData)
	require.NoError(t, err)
	require.Len(t, metrics, 13)

	converter := NewMetricConverter()

	metricFrames, err := converter.Convert(metrics)
	require.NoError(t, err)
	require.Len(t, metricFrames, 1)

	for _, mf := range metricFrames {
		frame := mf.Frame()
		require.Len(t, frame.Fields, 131) // 10 measurements across 13 metrics + time field.
	}
}

func BenchmarkMetricConverter_Convert(b *testing.B) {
	testData := loadTestData(b, "same_metrics_different_labels_same_time")
	parser := NewInfluxParser()
	metrics, err := parser.Parse(testData)
	require.NoError(b, err)
	require.Len(b, metrics, 13)

	converter := NewMetricConverter()

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := converter.Convert(metrics)
		if err != nil {
			b.Fatal(err)
		}
	}
}

package azuremonitor

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func TestInsightsMetricsResultToFrame(t *testing.T) {
	tests := []struct {
		name          string
		testFile      string
		metric        string
		alias         string
		agg           string
		dimensions    []string
		expectedFrame func() *data.Frame
	}{
		{
			name:     "single series",
			testFile: "applicationinsights/4-application-insights-response-metrics-no-segment.json",
			metric:   "value",
			agg:      "avg",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("StartTime", nil, []time.Time{
						time.Date(2019, 9, 13, 1, 2, 3, 456789000, time.UTC),
						time.Date(2019, 9, 13, 2, 2, 3, 456789000, time.UTC),
					}),
					data.NewField("value", nil, []*float64{
						pointer.Float64(1),
						pointer.Float64(2),
					}),
				)
				return frame
			},
		},
		{
			name:     "empty response",
			testFile: "applicationinsights/5-application-insights-empty-response.json",
			metric:   "value",
			agg:      "avg",
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("", data.NewField("StartTime", nil, []time.Time{}))
				return frame
			},
		},
		{
			name:       "segmented series",
			testFile:   "applicationinsights/4-application-insights-response-metrics-segmented.json",
			metric:     "value",
			agg:        "avg",
			dimensions: []string{"blob"},
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("StartTime", nil, []time.Time{
						time.Date(2019, 9, 13, 1, 2, 3, 456789000, time.UTC),
						time.Date(2019, 9, 13, 2, 2, 3, 456789000, time.UTC),
					}),
					data.NewField("value", data.Labels{"blob": "a"}, []*float64{
						pointer.Float64(1),
						pointer.Float64(2),
					}),
					data.NewField("value", data.Labels{"blob": "b"}, []*float64{
						pointer.Float64(3),
						pointer.Float64(4),
					}),
				)
				return frame
			},
		},
		{
			name:       "multi segmented series",
			testFile:   "applicationinsights/4-application-insights-response-metrics-multi-segmented.json",
			metric:     "traces/count",
			agg:        "sum",
			dimensions: []string{"client/countryOrRegion", "client/city"},
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("StartTime", nil, []time.Time{
						time.Date(2020, 6, 25, 16, 15, 32, 14e7, time.UTC),
						time.Date(2020, 6, 25, 16, 16, 0, 0, time.UTC),
					}),
					data.NewField("traces/count", data.Labels{"client/city": "Tokyo", "client/countryOrRegion": "Japan"}, []*float64{
						nil,
						pointer.Float64(1),
					}),
					data.NewField("traces/count", data.Labels{"client/city": "", "client/countryOrRegion": "United States"}, []*float64{
						nil,
						pointer.Float64(11),
					}),
					data.NewField("traces/count", data.Labels{"client/city": "Chicago", "client/countryOrRegion": "United States"}, []*float64{
						nil,
						pointer.Float64(3),
					}),
					data.NewField("traces/count", data.Labels{"client/city": "Des Moines", "client/countryOrRegion": "United States"}, []*float64{
						pointer.Float64(2),
						pointer.Float64(1),
					}),
					data.NewField("traces/count", data.Labels{"client/city": "Washington", "client/countryOrRegion": "United States"}, []*float64{
						pointer.Float64(2),
						nil,
					}),
				)

				return frame
			},
		},
		{
			name:       "segmented series with alias",
			testFile:   "applicationinsights/4-application-insights-response-metrics-multi-segmented.json",
			metric:     "traces/count",
			alias:      "{{ metric }}: Country,City: {{ client/countryOrRegion }},{{ client/city }}",
			agg:        "sum",
			dimensions: []string{"client/countryOrRegion", "client/city"},
			expectedFrame: func() *data.Frame {
				frame := data.NewFrame("",
					data.NewField("StartTime", nil, []time.Time{
						time.Date(2020, 6, 25, 16, 15, 32, 14e7, time.UTC),
						time.Date(2020, 6, 25, 16, 16, 0, 0, time.UTC),
					}),
					data.NewField("traces/count", data.Labels{"client/city": "Tokyo", "client/countryOrRegion": "Japan"}, []*float64{
						nil,
						pointer.Float64(1),
					}).SetConfig(&data.FieldConfig{DisplayName: "traces/count: Country,City: Japan,Tokyo"}),
					data.NewField("traces/count", data.Labels{"client/city": "", "client/countryOrRegion": "United States"}, []*float64{
						nil,
						pointer.Float64(11),
					}).SetConfig(&data.FieldConfig{DisplayName: "traces/count: Country,City: United States,"}),
					data.NewField("traces/count", data.Labels{"client/city": "Chicago", "client/countryOrRegion": "United States"}, []*float64{
						nil,
						pointer.Float64(3),
					}).SetConfig(&data.FieldConfig{DisplayName: "traces/count: Country,City: United States,Chicago"}),

					data.NewField("traces/count", data.Labels{"client/city": "Des Moines", "client/countryOrRegion": "United States"}, []*float64{
						pointer.Float64(2),
						pointer.Float64(1),
					}).SetConfig(&data.FieldConfig{DisplayName: "traces/count: Country,City: United States,Des Moines"}),

					data.NewField("traces/count", data.Labels{"client/city": "Washington", "client/countryOrRegion": "United States"}, []*float64{
						pointer.Float64(2),
						nil,
					}).SetConfig(&data.FieldConfig{DisplayName: "traces/count: Country,City: United States,Washington"}),
				)

				return frame
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := loadInsightsMetricsResponse(tt.testFile)
			require.NoError(t, err)

			frame, err := InsightsMetricsResultToFrame(res, tt.metric, tt.agg, tt.dimensions)
			require.NoError(t, err)

			applyInsightsMetricAlias(frame, tt.alias)

			if diff := cmp.Diff(tt.expectedFrame(), frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func loadInsightsMetricsResponse(name string) (MetricsResult, error) {
	var mr MetricsResult

	path := filepath.Join("testdata", name)
	f, err := os.Open(path)
	if err != nil {
		return mr, err
	}
	defer f.Close()
	d := json.NewDecoder(f)
	err = d.Decode(&mr)
	return mr, err
}

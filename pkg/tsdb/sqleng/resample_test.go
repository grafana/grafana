package sqleng

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func TestResampleWide(t *testing.T) {
	tests := []struct {
		name        string
		input       *data.Frame
		fillMissing *data.FillMissing
		timeRange   backend.TimeRange
		interval    time.Duration
		output      *data.Frame
	}{
		{
			name:        "interval 1s; fill null",
			fillMissing: &data.FillMissing{Mode: data.FillModeNull},
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
			},
			interval: time.Second,
			input: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(15),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(15.0),
				})),
			output: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 21, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 22, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 23, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 25, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					nil,
					pointer.Int64(10),
					pointer.Int64(12),
					nil,
					nil,
					nil,
					pointer.Int64(15),
					nil,
					nil,
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					nil,
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					nil,
					nil,
					nil,
					pointer.Float64(15.0),
					nil,
					nil,
				})),
		},
		{
			name:        "interval 1s; fill value",
			fillMissing: &data.FillMissing{Mode: data.FillModeValue, Value: -1},
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
			},
			interval: time.Second,
			input: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(15),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(15.0),
				})),
			output: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 21, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 22, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 23, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 25, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(-1),
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(-1),
					pointer.Int64(-1),
					pointer.Int64(-1),
					pointer.Int64(15),
					pointer.Int64(-1),
					pointer.Int64(-1),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(-1),
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(-1),
					pointer.Float64(-1),
					pointer.Float64(-1),
					pointer.Float64(15.0),
					pointer.Float64(-1),
					pointer.Float64(-1),
				})),
		},
		{
			name:        "interval 1s; fill previous",
			fillMissing: &data.FillMissing{Mode: data.FillModePrevious},
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
			},
			interval: time.Second,
			input: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(15),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(15.0),
				})),
			output: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 21, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 22, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 23, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 25, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					nil,
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(12),
					pointer.Int64(12),
					pointer.Int64(12),
					pointer.Int64(15),
					pointer.Int64(15),
					pointer.Int64(15),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					nil,
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(12.5),
					pointer.Float64(12.5),
					pointer.Float64(12.5),
					pointer.Float64(15.0),
					pointer.Float64(15.0),
					pointer.Float64(15.0),
				})),
		},
		{
			name:        "interval 2s; fill null",
			fillMissing: &data.FillMissing{Mode: data.FillModeNull},
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
			},
			interval: 2 * time.Second,
			input: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(15),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(15.0),
				})),
			output: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 18, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 22, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 26, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(10),
					pointer.Int64(12),
					nil,
					pointer.Int64(15),
					nil,
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					nil,
					pointer.Float64(15.0),
					nil,
				})),
		},
		{
			name:        "interval 1s; fill null; rows outside timerange window",
			fillMissing: &data.FillMissing{Mode: data.FillModeNull},
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
			},
			interval: time.Second,
			input: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 19, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 27, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(10),
					pointer.Int64(12),
					pointer.Int64(15),
					pointer.Int64(18),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(10.5),
					pointer.Float64(12.5),
					pointer.Float64(15.0),
					pointer.Float64(17.5),
				})),
			output: data.NewFrame("wide_test",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 21, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 22, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 23, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
				}),
				data.NewField("Values Ints", nil, []*int64{
					pointer.Int64(12),
					nil,
					nil,
					nil,
					pointer.Int64(15),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					pointer.Float64(12.5),
					nil,
					nil,
					nil,
					pointer.Float64(15.0),
				})),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			frame, err := resample(tt.input, dataQueryModel{
				FillMissing: tt.fillMissing,
				TimeRange:   tt.timeRange,
				Interval:    tt.interval,
			})
			require.NoError(t, err)
			if diff := cmp.Diff(tt.output, frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

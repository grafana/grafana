package sqleng

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(15.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					nil,
					nil,
					nil,
					util.Pointer(int64(15)),
					nil,
					nil,
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					nil,
					util.Pointer(10.5),
					util.Pointer(12.5),
					nil,
					nil,
					nil,
					util.Pointer(15.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(15.0),
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
					util.Pointer(int64(-1)),
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(-1)),
					util.Pointer(int64(-1)),
					util.Pointer(int64(-1)),
					util.Pointer(int64(15)),
					util.Pointer(int64(-1)),
					util.Pointer(int64(-1)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(-1.0),
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(-1.0),
					util.Pointer(-1.0),
					util.Pointer(-1.0),
					util.Pointer(15.0),
					util.Pointer(-1.0),
					util.Pointer(-1.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(15.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(12)),
					util.Pointer(int64(12)),
					util.Pointer(int64(12)),
					util.Pointer(int64(15)),
					util.Pointer(int64(15)),
					util.Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					nil,
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(12.5),
					util.Pointer(12.5),
					util.Pointer(12.5),
					util.Pointer(15.0),
					util.Pointer(15.0),
					util.Pointer(15.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(15.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					nil,
					util.Pointer(int64(15)),
					nil,
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(10.5),
					util.Pointer(12.5),
					nil,
					util.Pointer(15.0),
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
					util.Pointer(int64(10)),
					util.Pointer(int64(12)),
					util.Pointer(int64(15)),
					util.Pointer(int64(18)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(10.5),
					util.Pointer(12.5),
					util.Pointer(15.0),
					util.Pointer(17.5),
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
					util.Pointer(int64(12)),
					nil,
					nil,
					nil,
					util.Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					util.Pointer(12.5),
					nil,
					nil,
					nil,
					util.Pointer(15.0),
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

package resample

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func Pointer[T any](v T) *T { return &v }

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
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(10.5),
					Pointer(12.5),
					Pointer(15.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					nil,
					nil,
					nil,
					Pointer(int64(15)),
					nil,
					nil,
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					nil,
					Pointer(10.5),
					Pointer(12.5),
					nil,
					nil,
					nil,
					Pointer(15.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(10.5),
					Pointer(12.5),
					Pointer(15.0),
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
					Pointer(int64(-1)),
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(-1)),
					Pointer(int64(-1)),
					Pointer(int64(-1)),
					Pointer(int64(15)),
					Pointer(int64(-1)),
					Pointer(int64(-1)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(-1.0),
					Pointer(10.5),
					Pointer(12.5),
					Pointer(-1.0),
					Pointer(-1.0),
					Pointer(-1.0),
					Pointer(15.0),
					Pointer(-1.0),
					Pointer(-1.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(10.5),
					Pointer(12.5),
					Pointer(15.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(12)),
					Pointer(int64(12)),
					Pointer(int64(12)),
					Pointer(int64(15)),
					Pointer(int64(15)),
					Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					nil,
					Pointer(10.5),
					Pointer(12.5),
					Pointer(12.5),
					Pointer(12.5),
					Pointer(12.5),
					Pointer(15.0),
					Pointer(15.0),
					Pointer(15.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(10.5),
					Pointer(12.5),
					Pointer(15.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					nil,
					Pointer(int64(15)),
					nil,
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(10.5),
					Pointer(12.5),
					nil,
					Pointer(15.0),
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
					Pointer(int64(10)),
					Pointer(int64(12)),
					Pointer(int64(15)),
					Pointer(int64(18)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(10.5),
					Pointer(12.5),
					Pointer(15.0),
					Pointer(17.5),
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
					Pointer(int64(12)),
					nil,
					nil,
					nil,
					Pointer(int64(15)),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []*float64{
					Pointer(12.5),
					nil,
					nil,
					nil,
					Pointer(15.0),
				})),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			frame, err := Resample(tt.input, tt.fillMissing, tt.timeRange, tt.interval)
			require.NoError(t, err)
			if diff := cmp.Diff(tt.output, frame, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

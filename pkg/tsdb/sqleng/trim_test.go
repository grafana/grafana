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

func TestTrimWide(t *testing.T) {
	tests := []struct {
		name      string
		input     *data.Frame
		timeRange backend.TimeRange
		output    *data.Frame
	}{
		{
			name: "needs trimming",
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 20, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 24, 0, time.UTC),
			},
			input: data.NewFrame("wide_test",
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
		{
			name: "does not need trimming",
			timeRange: backend.TimeRange{
				From: time.Date(2020, 1, 2, 3, 4, 15, 0, time.UTC),
				To:   time.Date(2020, 1, 2, 3, 4, 30, 0, time.UTC),
			},
			input: data.NewFrame("wide_test",
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
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := trim(tt.input, dataQueryModel{
				TimeRange: tt.timeRange,
			})
			require.NoError(t, err)
			if diff := cmp.Diff(tt.output, tt.input, data.FrameTestCompareOptions()...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

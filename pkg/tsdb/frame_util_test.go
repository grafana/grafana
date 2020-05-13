package tsdb

import (
	"math"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func TestFrameToSeriesSlice(t *testing.T) {
	tests := []struct {
		name        string
		frame       *data.Frame
		seriesSlice TimeSeriesSlice
		Err         require.ErrorAssertionFunc
	}{
		{
			name: "a wide series",
			frame: data.NewFrame("",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 0, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 30, 0, time.UTC),
				}),
				data.NewField(`Values Int64s`, data.Labels{"Animal Factor": "cat"}, []*int64{
					nil,
					pointer.Int64(3),
				}),
				data.NewField(`Values Floats`, data.Labels{"Animal Factor": "sloth"}, []float64{
					2.0,
					4.0,
				})),

			seriesSlice: TimeSeriesSlice{
				&TimeSeries{
					Name: "Values Int64s",
					Tags: map[string]string{"Animal Factor": "cat"},
					Points: TimeSeriesPoints{
						TimePoint{null.FloatFrom(math.NaN()), null.FloatFrom(1577934240000)},
						TimePoint{null.FloatFrom(3), null.FloatFrom(1577934270000)},
					},
				},
				&TimeSeries{
					Name: "Values Floats",
					Tags: map[string]string{"Animal Factor": "sloth"},
					Points: TimeSeriesPoints{
						TimePoint{null.FloatFrom(2), null.FloatFrom(1577934240000)},
						TimePoint{null.FloatFrom(4), null.FloatFrom(1577934270000)},
					},
				},
			},
			Err: require.NoError,
		},
		{
			name: "a long series",
			frame: data.NewFrame("",
				data.NewField("Time", nil, []time.Time{
					time.Date(2020, 1, 2, 3, 4, 0, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 0, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 30, 0, time.UTC),
					time.Date(2020, 1, 2, 3, 4, 30, 0, time.UTC),
				}),
				data.NewField("Values Floats", nil, []float64{
					1.0,
					2.0,
					3.0,
					4.0,
				}),
				data.NewField("Values Int64", nil, []int64{
					1,
					2,
					3,
					4,
				}),
				data.NewField("Animal Factor", nil, []string{
					"cat",
					"sloth",
					"cat",
					"sloth",
				}),
				data.NewField("Location", nil, []string{
					"Florida",
					"Central & South America",
					"Florida",
					"Central & South America",
				})),

			seriesSlice: TimeSeriesSlice{
				&TimeSeries{
					Name: "Values Floats",
					Tags: map[string]string{"Animal Factor": "cat", "Location": "Florida"},
					Points: TimeSeriesPoints{
						TimePoint{null.FloatFrom(1), null.FloatFrom(1577934240000)},
						TimePoint{null.FloatFrom(3), null.FloatFrom(1577934270000)},
					},
				},
				&TimeSeries{
					Name: "Values Int64",
					Tags: map[string]string{"Animal Factor": "cat", "Location": "Florida"},
					Points: TimeSeriesPoints{
						TimePoint{null.FloatFrom(1), null.FloatFrom(1577934240000)},
						TimePoint{null.FloatFrom(3), null.FloatFrom(1577934270000)},
					},
				},
				&TimeSeries{
					Name: "Values Floats",
					Tags: map[string]string{"Animal Factor": "sloth", "Location": "Central & South America"},
					Points: TimeSeriesPoints{
						TimePoint{null.FloatFrom(2), null.FloatFrom(1577934240000)},
						TimePoint{null.FloatFrom(4), null.FloatFrom(1577934270000)},
					},
				},
				&TimeSeries{
					Name: "Values Int64",
					Tags: map[string]string{"Animal Factor": "sloth", "Location": "Central & South America"},
					Points: TimeSeriesPoints{
						TimePoint{null.FloatFrom(2), null.FloatFrom(1577934240000)},
						TimePoint{null.FloatFrom(4), null.FloatFrom(1577934270000)},
					},
				},
			},
			Err: require.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seriesSlice, err := FrameToSeriesSlice(tt.frame)
			tt.Err(t, err)
			if diff := cmp.Diff(tt.seriesSlice, seriesSlice, cmpopts.EquateNaNs()); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

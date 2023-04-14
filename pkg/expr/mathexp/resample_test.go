package mathexp

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResampleSeries(t *testing.T) {
	var tests = []struct {
		name             string
		interval         time.Duration
		downsampler      string
		upsampler        string
		timeRange        backend.TimeRange
		seriesToResample Series
		series           Series
	}{
		{
			name:        "resample series: time range shorter than the rule interval",
			interval:    time.Second * 5,
			downsampler: "mean",
			upsampler:   "fillna",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(4, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}),
		},
		{
			name:        "resample series: invalid time range",
			interval:    time.Second * 5,
			downsampler: "mean",
			upsampler:   "fillna",
			timeRange: backend.TimeRange{
				From: time.Unix(11, 0),
				To:   time.Unix(0, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}),
		},
		{
			name:        "resample series: downsampling (mean / pad)",
			interval:    time.Second * 5,
			downsampler: "mean",
			upsampler:   "pad",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(16, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(3),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}, tp{
				time.Unix(9, 0), float64Pointer(2),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), nil,
			}, tp{
				time.Unix(5, 0), float64Pointer(2.5),
			}, tp{
				time.Unix(10, 0), float64Pointer(1.5),
			}, tp{
				time.Unix(15, 0), float64Pointer(2),
			}),
		},
		{
			name:        "resample series: downsampling (max / fillna)",
			interval:    time.Second * 5,
			downsampler: "max",
			upsampler:   "fillna",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(16, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(3),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}, tp{
				time.Unix(9, 0), float64Pointer(2),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), nil,
			}, tp{
				time.Unix(5, 0), float64Pointer(3),
			}, tp{
				time.Unix(10, 0), float64Pointer(2),
			}, tp{
				time.Unix(15, 0), nil,
			}),
		},
		{
			name:        "resample series: downsampling (min / fillna)",
			interval:    time.Second * 5,
			downsampler: "min",
			upsampler:   "fillna",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(16, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(3),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}, tp{
				time.Unix(9, 0), float64Pointer(2),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), nil,
			}, tp{
				time.Unix(5, 0), float64Pointer(2),
			}, tp{
				time.Unix(10, 0), float64Pointer(1),
			}, tp{
				time.Unix(15, 0), nil,
			}),
		},
		{
			name:        "resample series: downsampling (sum / fillna)",
			interval:    time.Second * 5,
			downsampler: "sum",
			upsampler:   "fillna",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(16, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(3),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}, tp{
				time.Unix(9, 0), float64Pointer(2),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), nil,
			}, tp{
				time.Unix(5, 0), float64Pointer(5),
			}, tp{
				time.Unix(10, 0), float64Pointer(3),
			}, tp{
				time.Unix(15, 0), nil,
			}),
		},
		{
			name:        "resample series: downsampling (mean / fillna)",
			interval:    time.Second * 5,
			downsampler: "mean",
			upsampler:   "fillna",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(16, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(3),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}, tp{
				time.Unix(9, 0), float64Pointer(2),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), nil,
			}, tp{
				time.Unix(5, 0), float64Pointer(2.5),
			}, tp{
				time.Unix(10, 0), float64Pointer(1.5),
			}, tp{
				time.Unix(15, 0), nil,
			}),
		},
		{
			name:        "resample series: upsampling (mean / pad )",
			interval:    time.Second * 2,
			downsampler: "mean",
			upsampler:   "pad",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(11, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), nil,
			}, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(2),
			}, tp{
				time.Unix(6, 0), float64Pointer(2),
			}, tp{
				time.Unix(8, 0), float64Pointer(1),
			}, tp{
				time.Unix(10, 0), float64Pointer(1),
			}),
		},
		{
			name:        "resample series: upsampling (mean / backfilling )",
			interval:    time.Second * 2,
			downsampler: "mean",
			upsampler:   "backfilling",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(11, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(7, 0), float64Pointer(1),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), float64Pointer(2),
			}, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(1),
			}, tp{
				time.Unix(6, 0), float64Pointer(1),
			}, tp{
				time.Unix(8, 0), float64Pointer(1),
			}, tp{
				time.Unix(10, 0), nil,
			}),
		},
		{
			name:        "resample series: downsampling (last / pad )",
			interval:    time.Second * 3,
			downsampler: "last",
			upsampler:   "pad",
			timeRange: backend.TimeRange{
				From: time.Unix(0, 0),
				To:   time.Unix(11, 0),
			},
			seriesToResample: makeSeries("", nil, tp{
				time.Unix(0, 0), float64Pointer(0),
			}, tp{
				time.Unix(2, 0), float64Pointer(2),
			}, tp{
				time.Unix(4, 0), float64Pointer(3),
			}, tp{
				time.Unix(6, 0), float64Pointer(4),
			}, tp{
				time.Unix(8, 0), float64Pointer(0),
			}, tp{
				time.Unix(10, 0), float64Pointer(1),
			}),
			series: makeSeries("", nil, tp{
				time.Unix(0, 0), float64Pointer(0),
			}, tp{
				time.Unix(3, 0), float64Pointer(2),
			}, tp{
				time.Unix(6, 0), float64Pointer(4),
			}, tp{
				time.Unix(9, 0), float64Pointer(0),
			}),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			series, err := tt.seriesToResample.Resample("", tt.interval, tt.downsampler, tt.upsampler, tt.timeRange.From, tt.timeRange.To)
			if tt.series.Frame == nil {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.series, series)
			}
		})
	}
}

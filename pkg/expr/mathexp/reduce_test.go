package mathexp

import (
	"math"
	"math/rand"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

var seriesWithNil = Vars{
	"A": Results{
		[]Value{
			makeSeries("temp", nil, tp{
				time.Unix(5, 0), float64Pointer(2),
			}, tp{
				time.Unix(10, 0), nil,
			}),
		},
	},
}

var seriesEmpty = Vars{
	"A": Results{
		[]Value{
			makeSeries("temp", nil),
		},
	},
}

func TestSeriesReduce(t *testing.T) {
	var tests = []struct {
		name        string
		red         string
		vars        Vars
		varToReduce string
		errIs       require.ErrorAssertionFunc
		resultsIs   require.ComparisonAssertionFunc
		results     Results
	}{
		{
			name:        "foo reduction will error",
			red:         "foo",
			varToReduce: "A",
			vars:        aSeries,
			errIs:       require.Error,
			resultsIs:   require.Equal,
		},
		{
			name:        "sum series",
			red:         "sum",
			varToReduce: "A",
			vars:        aSeries,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(3)),
				},
			},
		},
		{
			name:        "sum series with a nil value",
			red:         "sum",
			varToReduce: "A",
			vars:        seriesWithNil,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "sum empty series",
			red:         "sum",
			varToReduce: "A",
			vars:        seriesEmpty,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(0)),
				},
			},
		},
		{
			name:        "mean series with a nil value",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesWithNil,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "mean empty series",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesEmpty,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "min series with a nil value",
			red:         "min",
			varToReduce: "A",
			vars:        seriesWithNil,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "min empty series",
			red:         "min",
			varToReduce: "A",
			vars:        seriesEmpty,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "max series with a nil value",
			red:         "max",
			varToReduce: "A",
			vars:        seriesWithNil,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "max empty series",
			red:         "max",
			varToReduce: "A",
			vars:        seriesEmpty,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "mean series",
			red:         "mean",
			varToReduce: "A",
			vars:        aSeries,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(1.5)),
				},
			},
		},
		{
			name:        "count empty series",
			red:         "count",
			varToReduce: "A",
			vars:        seriesEmpty,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(0)),
				},
			},
		},
		{
			name:        "mean series with labels",
			red:         "mean",
			varToReduce: "A",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("temp", data.Labels{"host": "a"}, tp{
							time.Unix(5, 0), float64Pointer(2),
						}, tp{
							time.Unix(10, 0), float64Pointer(1),
						}),
					},
				},
			},
			errIs:     require.NoError,
			resultsIs: require.Equal,
			results: Results{
				[]Value{
					makeNumber("", data.Labels{"host": "a"}, float64Pointer(1.5)),
				},
			},
		},
		{
			name:        "last empty series",
			red:         "last",
			varToReduce: "A",
			vars:        seriesEmpty,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, NaN),
				},
			},
		},
		{
			name:        "last null series",
			red:         "last",
			varToReduce: "A",
			vars:        seriesWithNil,
			errIs:       require.NoError,
			resultsIs:   require.Equal,
			results: Results{
				[]Value{
					makeNumber("", nil, nil),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results := Results{}
			seriesSet := tt.vars[tt.varToReduce]
			for _, series := range seriesSet.Values {
				ns, err := series.Value().(*Series).Reduce("", tt.red, nil)
				tt.errIs(t, err)
				if err != nil {
					return
				}
				results.Values = append(results.Values, ns)
			}
			opt := cmp.Comparer(func(x, y float64) bool {
				return (math.IsNaN(x) && math.IsNaN(y)) || x == y
			})
			options := append([]cmp.Option{opt}, data.FrameTestCompareOptions()...)
			if diff := cmp.Diff(tt.results, results, options...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

var seriesNonNumbers = Vars{
	"A": Results{
		[]Value{
			makeSeries("temp", nil,
				tp{time.Unix(5, 0), NaN},
				tp{time.Unix(10, 0), float64Pointer(math.Inf(-1))},
				tp{time.Unix(15, 0), float64Pointer(math.Inf(1))},
				tp{time.Unix(15, 0), nil}),
		},
	},
}

func TestSeriesReduceDropNN(t *testing.T) {
	var tests = []struct {
		name        string
		red         string
		vars        Vars
		varToReduce string
		results     Results
	}{
		{
			name:        "dropNN: sum series",
			red:         "sum",
			varToReduce: "A",
			vars:        aSeries,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(3)),
				},
			},
		},
		{
			name:        "dropNN: sum series with a nil value",
			red:         "sum",
			varToReduce: "A",
			vars:        seriesWithNil,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(2)),
				},
			},
		},
		{
			name:        "dropNN: sum empty series",
			red:         "sum",
			varToReduce: "A",
			vars:        seriesEmpty,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(0)),
				},
			},
		},
		{
			name:        "dropNN: mean series with a nil value and real value",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesWithNil,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(2)),
				},
			},
		},
		{
			name:        "DropNN: mean empty series",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesEmpty,
			results: Results{
				[]Value{
					makeNumber("", nil, nil),
				},
			},
		},
		{
			name:        "DropNN: mean series that becomes empty after filtering non-number",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesNonNumbers,
			results: Results{
				[]Value{
					makeNumber("", nil, nil),
				},
			},
		},
		{
			name:        "DropNN: count empty series",
			red:         "count",
			varToReduce: "A",
			vars:        seriesEmpty,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(0)),
				},
			},
		},
		{
			name:        "DropNN: count series with nil and value should only count real numbers",
			red:         "count",
			varToReduce: "A",
			vars:        seriesWithNil,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(1)),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results := Results{}
			seriesSet := tt.vars[tt.varToReduce]
			for _, series := range seriesSet.Values {
				ns, err := series.Value().(*Series).Reduce("", tt.red, DropNonNumber{})
				require.NoError(t, err)
				results.Values = append(results.Values, ns)
			}
			opt := cmp.Comparer(func(x, y float64) bool {
				return (math.IsNaN(x) && math.IsNaN(y)) || x == y
			})
			options := append([]cmp.Option{opt}, data.FrameTestCompareOptions()...)
			if diff := cmp.Diff(tt.results, results, options...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSeriesReduceReplaceNN(t *testing.T) {
	replaceWith := rand.Float64()
	var tests = []struct {
		name        string
		red         string
		vars        Vars
		varToReduce string
		results     Results
	}{
		{
			name:        "replaceNN: sum series",
			red:         "sum",
			varToReduce: "A",
			vars:        aSeries,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(3)),
				},
			},
		},
		{
			name:        "replaceNN: sum series with a nil value",
			red:         "sum",
			varToReduce: "A",
			vars:        seriesWithNil,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(replaceWith+2)),
				},
			},
		},
		{
			name:        "replaceNN: sum empty series",
			red:         "sum",
			varToReduce: "A",
			vars:        seriesEmpty,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(0)),
				},
			},
		},
		{
			name:        "replaceNN: mean series with a nil value and real value",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesWithNil,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer((2+replaceWith)/2e0)),
				},
			},
		},
		{
			name:        "replaceNN: mean empty series",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesEmpty,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(replaceWith)),
				},
			},
		},
		{
			name:        "replaceNN: mean series that becomes empty after filtering non-number",
			red:         "mean",
			varToReduce: "A",
			vars:        seriesNonNumbers,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(replaceWith)),
				},
			},
		},
		{
			name:        "replaceNN: count empty series",
			red:         "count",
			varToReduce: "A",
			vars:        seriesEmpty,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(0)),
				},
			},
		},
		{
			name:        "replaceNN: count series with nil and value should only count real numbers",
			red:         "count",
			varToReduce: "A",
			vars:        seriesWithNil,
			results: Results{
				[]Value{
					makeNumber("", nil, float64Pointer(2)),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results := Results{}
			seriesSet := tt.vars[tt.varToReduce]
			for _, series := range seriesSet.Values {
				ns, err := series.Value().(*Series).Reduce("", tt.red, ReplaceNonNumberWithValue{Value: replaceWith})
				require.NoError(t, err)
				results.Values = append(results.Values, ns)
			}
			opt := cmp.Comparer(func(x, y float64) bool {
				return (math.IsNaN(x) && math.IsNaN(y)) || x == y
			})
			options := append([]cmp.Option{opt}, data.FrameTestCompareOptions()...)
			if diff := cmp.Diff(tt.results, results, options...); diff != "" {
				t.Errorf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

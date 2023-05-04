package mathexp

import (
	"math"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"
)

func TestAbsFunc(t *testing.T) {
	var tests = []struct {
		name      string
		expr      string
		vars      Vars
		newErrIs  require.ErrorAssertionFunc
		execErrIs require.ErrorAssertionFunc
		resultIs  require.ComparisonAssertionFunc
		results   Results
	}{
		{
			name: "abs on number",
			expr: "abs($A)",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, float64Pointer(-7)),
					},
				},
			},
			newErrIs:  require.NoError,
			execErrIs: require.NoError,
			resultIs:  require.Equal,
			results:   Results{[]Value{makeNumber("", nil, float64Pointer(7))}},
		},
		{
			name:      "abs on scalar",
			expr:      "abs(-1)",
			vars:      Vars{},
			newErrIs:  require.NoError,
			execErrIs: require.NoError,
			resultIs:  require.Equal,
			results:   Results{[]Value{NewScalar("", float64Pointer(1.0))}},
		},
		{
			name: "abs on series",
			expr: "abs($A)",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("", nil, tp{
							time.Unix(5, 0), float64Pointer(-2),
						}, tp{
							time.Unix(10, 0), float64Pointer(-1),
						}),
					},
				},
			},
			newErrIs:  require.NoError,
			execErrIs: require.NoError,
			resultIs:  require.Equal,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(2),
					}, tp{
						time.Unix(10, 0), float64Pointer(1),
					}),
				},
			},
		},
		{
			name:     "abs on string - should error",
			expr:     `abs("hi")`,
			vars:     Vars{},
			newErrIs: require.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, err := New(tt.expr)
			tt.newErrIs(t, err)
			if e != nil {
				res, err := e.Execute("", tt.vars, tracing.NewFakeTracer())
				tt.execErrIs(t, err)
				tt.resultIs(t, tt.results, res)
			}
		})
	}
}

func TestIsNumberFunc(t *testing.T) {
	var tests = []struct {
		name    string
		expr    string
		vars    Vars
		results Results
	}{
		{
			name: "is_number on number type with real number value",
			expr: "is_number($A)",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, float64Pointer(6)),
					},
				},
			},
			results: Results{[]Value{makeNumber("", nil, float64Pointer(1))}},
		},
		{
			name: "is_number on number type with null value",
			expr: "is_number($A)",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, nil),
					},
				},
			},
			results: Results{[]Value{makeNumber("", nil, float64Pointer(0))}},
		},
		{
			name: "is_number on on series",
			expr: "is_number($A)",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("", nil,
							tp{time.Unix(5, 0), float64Pointer(5)},
							tp{time.Unix(10, 0), nil},
							tp{time.Unix(15, 0), float64Pointer(math.NaN())},
							tp{time.Unix(20, 0), float64Pointer(math.Inf(-1))},
							tp{time.Unix(25, 0), float64Pointer(math.Inf(0))}),
					},
				},
			},
			results: Results{
				[]Value{
					makeSeries("", nil,
						tp{time.Unix(5, 0), float64Pointer(1)},
						tp{time.Unix(10, 0), float64Pointer(0)},
						tp{time.Unix(15, 0), float64Pointer(0)},
						tp{time.Unix(20, 0), float64Pointer(0)},
						tp{time.Unix(25, 0), float64Pointer(0)}),
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, err := New(tt.expr)
			require.NoError(t, err)
			if e != nil {
				res, err := e.Execute("", tt.vars, tracing.NewFakeTracer())
				require.NoError(t, err)
				require.Equal(t, tt.results, res)
			}
		})
	}
}

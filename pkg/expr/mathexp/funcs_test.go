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
				"A": resultValuesNoErr(makeNumber("", nil, new(-7.0))),
			},
			newErrIs:  require.NoError,
			execErrIs: require.NoError,
			resultIs:  require.Equal,
			results:   resultValuesNoErr(makeNumber("", nil, new(7.0))),
		},
		{
			name:      "abs on scalar",
			expr:      "abs(-1)",
			vars:      Vars{},
			newErrIs:  require.NoError,
			execErrIs: require.NoError,
			resultIs:  require.Equal,
			results:   resultValuesNoErr(NewScalar("", new(1.0))),
		},
		{
			name: "abs on series",
			expr: "abs($A)",
			vars: Vars{
				"A": resultValuesNoErr(
					makeSeries("", nil, tp{
						time.Unix(5, 0), new(-2.0),
					}, tp{
						time.Unix(10, 0), new(-1.0),
					}),
				),
			},
			newErrIs:  require.NoError,
			execErrIs: require.NoError,
			resultIs:  require.Equal,
			results: resultValuesNoErr(
				makeSeries("", nil, tp{
					time.Unix(5, 0), new(2.0),
				}, tp{
					time.Unix(10, 0), new(1.0),
				}),
			),
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
				res, err := e.Execute("", tt.vars, tracing.InitializeTracerForTest())
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
				"A": resultValuesNoErr(makeNumber("", nil, new(6.0))),
			},
			results: resultValuesNoErr(makeNumber("", nil, new(1.0))),
		},
		{
			name: "is_number on number type with null value",
			expr: "is_number($A)",
			vars: Vars{
				"A": resultValuesNoErr(makeNumber("", nil, nil)),
			},
			results: resultValuesNoErr(makeNumber("", nil, new(0.0))),
		},
		{
			name: "is_number on on series",
			expr: "is_number($A)",
			vars: Vars{
				"A": resultValuesNoErr(
					makeSeries("", nil,
						tp{time.Unix(5, 0), new(5.0)},
						tp{time.Unix(10, 0), nil},
						tp{time.Unix(15, 0), new(math.NaN())},
						tp{time.Unix(20, 0), new(math.Inf(-1))},
						tp{time.Unix(25, 0), new(math.Inf(0))}),
				),
			},
			results: resultValuesNoErr(
				makeSeries("", nil,
					tp{time.Unix(5, 0), new(1.0)},
					tp{time.Unix(10, 0), new(0.0)},
					tp{time.Unix(15, 0), new(0.0)},
					tp{time.Unix(20, 0), new(0.0)},
					tp{time.Unix(25, 0), new(0.0)}),
			),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, err := New(tt.expr)
			require.NoError(t, err)
			if e != nil {
				res, err := e.Execute("", tt.vars, tracing.InitializeTracerForTest())
				require.NoError(t, err)
				require.Equal(t, tt.results, res)
			}
		})
	}
}

package mathexp

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestFunc(t *testing.T) {
	var tests = []struct {
		name      string
		expr      string
		vars      Vars
		newErrIs  assert.ErrorAssertionFunc
		execErrIs assert.ErrorAssertionFunc
		resultIs  assert.ComparisonAssertionFunc
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
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			resultIs:  assert.Equal,
			results:   Results{[]Value{makeNumber("", nil, float64Pointer(7))}},
		},
		{
			name:      "abs on scalar",
			expr:      "abs(-1)",
			vars:      Vars{},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			resultIs:  assert.Equal,
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
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			resultIs:  assert.Equal,
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
			newErrIs: assert.Error,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, err := New(tt.expr)
			tt.newErrIs(t, err)
			if e != nil {
				res, err := e.Execute("", tt.vars)
				tt.execErrIs(t, err)
				tt.resultIs(t, tt.results, res)
			}
		})
	}
}

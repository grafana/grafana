package mathexp

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/assert"
)

func TestSeriesExpr(t *testing.T) {
	var tests = []struct {
		name      string
		expr      string
		vars      Vars
		newErrIs  assert.ErrorAssertionFunc
		execErrIs assert.ErrorAssertionFunc
		results   Results
	}{
		{
			name:      "unary series",
			expr:      "! ! $A",
			vars:      aSeries,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{ // Not sure about preservering names...
						time.Unix(5, 0), float64Pointer(1),
					}, tp{
						time.Unix(10, 0), float64Pointer(1),
					}),
				},
			},
		},
		{
			name:      "binary scalar Op series",
			expr:      "98 + $A",
			vars:      aSeries,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{ // Not sure about preservering names...
						time.Unix(5, 0), float64Pointer(100),
					}, tp{
						time.Unix(10, 0), float64Pointer(99),
					}),
				},
			},
		},
		{
			name:      "binary series Op scalar",
			expr:      "$A + 98",
			vars:      aSeries,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{ // Not sure about preservering names...
						time.Unix(5, 0), float64Pointer(100),
					}, tp{
						time.Unix(10, 0), float64Pointer(99),
					}),
				},
			},
		},
		{
			name:      "series Op series",
			expr:      "$A + $A",
			vars:      aSeries,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{ // Not sure about preservering names...
						time.Unix(5, 0), float64Pointer(4),
					}, tp{
						time.Unix(10, 0), float64Pointer(2),
					}),
				},
			},
		},
		{
			name:      "series Op number",
			expr:      "$A + $B",
			vars:      aSeriesbNumber,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", data.Labels{"id": "1"}, tp{
						time.Unix(5, 0), float64Pointer(9),
					}, tp{
						time.Unix(10, 0), float64Pointer(8),
					}),
				},
			},
		},
		{
			name:      "number Op series",
			expr:      "$B + $A",
			vars:      aSeriesbNumber,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", data.Labels{"id": "1"}, tp{
						time.Unix(5, 0), float64Pointer(9),
					}, tp{
						time.Unix(10, 0), float64Pointer(8),
					}),
				},
			},
		},
		{
			name:      "series Op series with label union",
			expr:      "$A * $B",
			vars:      twoSeriesSets,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", data.Labels{"sensor": "a", "turbine": "1"}, tp{
						time.Unix(5, 0), float64Pointer(6 * .5),
					}, tp{
						time.Unix(10, 0), float64Pointer(8 * .2),
					}),
					makeSeries("", data.Labels{"sensor": "b", "turbine": "1"}, tp{
						time.Unix(5, 0), float64Pointer(10 * .5),
					}, tp{
						time.Unix(10, 0), float64Pointer(16 * .2),
					}),
				},
			},
		},
		// Length of resulting series is A when A + B. However, only points where the time matches
		// for A and B are added to the result
		{
			name: "series Op series with sparse time join",
			expr: "$A + $B",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("temp", data.Labels{}, tp{
							time.Unix(5, 0), float64Pointer(1),
						}, tp{
							time.Unix(10, 0), float64Pointer(2),
						}),
					},
				},
				"B": Results{
					[]Value{
						makeSeries("efficiency", data.Labels{}, tp{
							time.Unix(5, 0), float64Pointer(3),
						}, tp{
							time.Unix(9, 0), float64Pointer(4),
						}),
					},
				},
			},

			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{ // Not sure about preserving names...
						time.Unix(5, 0), float64Pointer(4),
					}),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, err := New(tt.expr)
			tt.newErrIs(t, err)
			if e != nil {
				res, err := e.Execute("", tt.vars, tracing.NewFakeTracer())
				tt.execErrIs(t, err)
				if diff := cmp.Diff(tt.results, res, data.FrameTestCompareOptions()...); diff != "" {
					t.Errorf("Result mismatch (-want +got):\n%s", diff)
				}
			}
		})
	}
}

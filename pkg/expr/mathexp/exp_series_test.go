package mathexp

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
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
			vars:      aSeriesNullableTime,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{ // Not sure about preservering names...
						unixTimePointer(5, 0), float64Pointer(1),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(1),
					}),
				},
			},
		},
		{
			name:      "binary scalar Op series",
			expr:      "98 + $A",
			vars:      aSeriesNullableTime,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{ // Not sure about preservering names...
						unixTimePointer(5, 0), float64Pointer(100),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(99),
					}),
				},
			},
		},
		{
			name:      "binary series Op scalar",
			expr:      "$A + 98",
			vars:      aSeriesNullableTime,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{ // Not sure about preservering names...
						unixTimePointer(5, 0), float64Pointer(100),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(99),
					}),
				},
			},
		},
		{
			name:      "series Op series",
			expr:      "$A + $A",
			vars:      aSeriesNullableTime,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{ // Not sure about preservering names...
						unixTimePointer(5, 0), float64Pointer(4),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(2),
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
					makeSeriesNullableTime("", data.Labels{"id": "1"}, nullTimeTP{
						unixTimePointer(5, 0), float64Pointer(9),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(8),
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
					makeSeriesNullableTime("", data.Labels{"id": "1"}, nullTimeTP{
						unixTimePointer(5, 0), float64Pointer(9),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(8),
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
					makeSeriesNullableTime("", data.Labels{"sensor": "a", "turbine": "1"}, nullTimeTP{
						unixTimePointer(5, 0), float64Pointer(6 * .5),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(8 * .2),
					}),
					makeSeriesNullableTime("", data.Labels{"sensor": "b", "turbine": "1"}, nullTimeTP{
						unixTimePointer(5, 0), float64Pointer(10 * .5),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(16 * .2),
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
						makeSeriesNullableTime("temp", data.Labels{}, nullTimeTP{
							unixTimePointer(5, 0), float64Pointer(1),
						}, nullTimeTP{
							unixTimePointer(10, 0), float64Pointer(2),
						}),
					},
				},
				"B": Results{
					[]Value{
						makeSeriesNullableTime("efficiency", data.Labels{}, nullTimeTP{
							unixTimePointer(5, 0), float64Pointer(3),
						}, nullTimeTP{
							unixTimePointer(9, 0), float64Pointer(4),
						}),
					},
				},
			},

			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{ // Not sure about preserving names...
						unixTimePointer(5, 0), float64Pointer(4),
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
				res, err := e.Execute("", tt.vars)
				tt.execErrIs(t, err)
				if diff := cmp.Diff(tt.results, res, data.FrameTestCompareOptions()...); diff != "" {
					t.Errorf("Result mismatch (-want +got):\n%s", diff)
				}
			}
		})
	}
}

func TestSeriesAlternateFormsExpr(t *testing.T) {
	var tests = []struct {
		name      string
		expr      string
		vars      Vars
		newErrIs  assert.ErrorAssertionFunc
		execErrIs assert.ErrorAssertionFunc
		results   Results
	}{
		{
			name:      "unary series: non-nullable time",
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
			name:      "unary series: non-nullable time, time second",
			expr:      "! ! $A",
			vars:      aSeriesTimeSecond,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesTimeSecond("", nil, timeSecondTP{ // Not sure about preservering names...
						float64Pointer(1), time.Unix(5, 0),
					}, timeSecondTP{
						float64Pointer(1), time.Unix(10, 0),
					}),
				},
			},
		},
		{
			name:      "unary series: non-nullable value",
			expr:      "! ! $A",
			vars:      aSeriesNoNull,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeNoNullSeries("", nil, noNullTP{ // Not sure about preservering names...
						time.Unix(5, 0), 1,
					}, noNullTP{
						time.Unix(10, 0), 1,
					}),
				},
			},
		},
		{
			name: "series Op series: nullable and non-nullable time",
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
						makeSeriesNullableTime("efficiency", data.Labels{}, nullTimeTP{
							unixTimePointer(5, 0), float64Pointer(3),
						}, nullTimeTP{
							unixTimePointer(10, 0), float64Pointer(4),
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{
						unixTimePointer(5, 0), float64Pointer(4),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(6),
					}),
				},
			},
		},
		{
			name: "series Op series: nullable (time second) and non-nullable time (time first)",
			expr: "$B + $A", // takes order from first operator
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeriesTimeSecond("temp", data.Labels{}, timeSecondTP{
							float64Pointer(1), time.Unix(5, 0),
						}, timeSecondTP{
							float64Pointer(2), time.Unix(10, 0),
						}),
					},
				},
				"B": Results{
					[]Value{
						makeSeriesNullableTime("efficiency", data.Labels{}, nullTimeTP{
							unixTimePointer(5, 0), float64Pointer(3),
						}, nullTimeTP{
							unixTimePointer(10, 0), float64Pointer(4),
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesNullableTime("", nil, nullTimeTP{
						unixTimePointer(5, 0), float64Pointer(4),
					}, nullTimeTP{
						unixTimePointer(10, 0), float64Pointer(6),
					}),
				},
			},
		},
		{
			name: "series Op series: nullable and non-nullable values",
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
						makeNoNullSeries("efficiency", data.Labels{}, noNullTP{
							time.Unix(5, 0), 3,
						}, noNullTP{
							time.Unix(10, 0), 4,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(4),
					}, tp{
						time.Unix(10, 0), float64Pointer(6),
					}),
				},
			},
		},
		{
			name:      "binary scalar Op series: non-nullable time second",
			expr:      "98 + $A",
			vars:      aSeriesTimeSecond,
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeriesTimeSecond("", nil, timeSecondTP{ // Not sure about preservering names...
						float64Pointer(100), time.Unix(5, 0),
					}, timeSecondTP{
						float64Pointer(99), time.Unix(10, 0),
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
				res, err := e.Execute("", tt.vars)
				tt.execErrIs(t, err)
				if diff := cmp.Diff(tt.results, res, data.FrameTestCompareOptions()...); diff != "" {
					t.Errorf("Result mismatch (-want +got):\n%s", diff)
				}
			}
		})
	}
}

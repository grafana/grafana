package mathexp

import (
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNaN(t *testing.T) {
	var tests = []struct {
		name      string
		expr      string
		vars      Vars
		newErrIs  assert.ErrorAssertionFunc
		execErrIs assert.ErrorAssertionFunc
		results   Results
		willPanic bool
	}{
		{
			name:      "unary !: Op Number(NaN) is NaN",
			expr:      "! $A",
			vars:      Vars{"A": Results{[]Value{makeNumber("", nil, NaN)}}},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   Results{[]Value{makeNumber("", nil, NaN)}},
		},
		{
			name:      "unary -: Op Number(NaN) is NaN",
			expr:      "-$A",
			vars:      Vars{"A": Results{[]Value{makeNumber("", nil, NaN)}}},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   Results{[]Value{makeNumber("", nil, NaN)}},
		},
		{
			name:      "binary: Scalar Op(Non-AND/OR) Number(NaN) is NaN",
			expr:      "1 * $A",
			vars:      Vars{"A": Results{[]Value{makeNumber("", nil, NaN)}}},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   Results{[]Value{makeNumber("", nil, NaN)}},
		},
		{
			name:      "binary: Scalar Op(AND/OR) Number(NaN) is 0/1",
			expr:      "1 || $A",
			vars:      Vars{"A": Results{[]Value{makeNumber("", nil, NaN)}}},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   Results{[]Value{makeNumber("", nil, float64Pointer(1))}},
		},
		{
			name: "binary: Scalar Op(Non-AND/OR) Series(with NaN value) is NaN)",
			expr: "1 - $A",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("temp", nil, tp{
							time.Unix(5, 0), float64Pointer(2),
						}, tp{
							time.Unix(10, 0), NaN,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(-1),
					}, tp{
						time.Unix(10, 0), NaN,
					}),
				},
			},
		},
		{
			name: "binary: Number Op(Non-AND/OR) Series(with NaN value) is Series with NaN",
			expr: "$A == $B",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("temp", nil, tp{
							time.Unix(5, 0), float64Pointer(2),
						}, tp{
							time.Unix(10, 0), NaN,
						}),
					},
				},
				"B": Results{[]Value{makeNumber("", nil, float64Pointer(0))}},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(0),
					}, tp{
						time.Unix(10, 0), NaN,
					}),
				},
			},
		},
		{
			name: "binary: Number(NaN) Op Series(with NaN value) is Series with NaN",
			expr: "$A + $B",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("temp", nil, tp{
							time.Unix(5, 0), float64Pointer(2),
						}, tp{
							time.Unix(10, 0), NaN,
						}),
					},
				},
				"B": Results{[]Value{makeNumber("", nil, NaN)}},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), NaN,
					}, tp{
						time.Unix(10, 0), NaN,
					}),
				},
			},
		},
	}

	opt := cmp.Comparer(func(x, y float64) bool {
		return (math.IsNaN(x) && math.IsNaN(y)) || x == y
	})
	options := append([]cmp.Option{opt}, data.FrameTestCompareOptions()...)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testBlock := func() {
				e, err := New(tt.expr)
				tt.newErrIs(t, err)
				if e != nil {
					res, err := e.Execute("", tt.vars, tracing.NewFakeTracer())
					tt.execErrIs(t, err)
					if diff := cmp.Diff(res, tt.results, options...); diff != "" {
						assert.FailNow(t, tt.name, diff)
					}
				}
			}
			if tt.willPanic {
				assert.Panics(t, testBlock)
			} else {
				assert.NotPanics(t, testBlock)
			}
		})
	}
}

func TestNullValues(t *testing.T) {
	var tests = []struct {
		name      string
		expr      string
		vars      Vars
		newErrIs  assert.ErrorAssertionFunc
		execErrIs assert.ErrorAssertionFunc
		results   Results
		willPanic bool
	}{
		{
			name:      "scalar: unary ! null(): is null",
			expr:      "! null()",
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   NewScalarResults("", nil),
		},
		{
			name:      "scalar: binary null() + null(): is null",
			expr:      "null() + null()",
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   NewScalarResults("", nil),
		},
		{
			name:      "scalar: binary 1 + null(): is null",
			expr:      "1 + null()",
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results:   NewScalarResults("", nil),
		},
		{
			name: "series: unary with a null value in it has a null value in result",
			expr: "- $A",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("", nil, tp{
							time.Unix(5, 0), float64Pointer(1),
						}, tp{
							time.Unix(10, 0), nil,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(-1),
					}, tp{
						time.Unix(10, 0), nil,
					}),
				},
			},
		},
		{
			name: "series: binary with a null value in it has a null value in result",
			expr: "$A - $A",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("", nil, tp{
							time.Unix(5, 0), float64Pointer(1),
						}, tp{
							time.Unix(10, 0), nil,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(0),
					}, tp{
						time.Unix(10, 0), nil,
					}),
				},
			},
		},
		{
			name: "series and scalar: binary with a null value in it has a nil value in result",
			expr: "$A - 1",
			vars: Vars{
				"A": Results{
					[]Value{
						makeSeries("", nil, tp{
							time.Unix(5, 0), float64Pointer(1),
						}, tp{
							time.Unix(10, 0), nil,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(0),
					}, tp{
						time.Unix(10, 0), nil,
					}),
				},
			},
		},
		{
			name: "number: unary ! null number: is null",
			expr: "! $A",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, nil),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeNumber("", nil, nil),
				},
			},
		},
		{
			name: "number: binary null number and null number: is null",
			expr: "$A + $A",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, nil),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeNumber("", nil, nil),
				},
			},
		},
		{
			name: "number: binary non-null number and null number: is null",
			expr: "$A * $B",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, nil),
					},
				},
				"B": Results{
					[]Value{
						makeNumber("", nil, float64Pointer(1)),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeNumber("", nil, nil),
				},
			},
		},
		{
			name: "number and series: binary non-null number and series with a null: is null",
			expr: "$A * $B",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, float64Pointer(1)),
					},
				},
				"B": Results{
					[]Value{
						makeSeries("", nil, tp{
							time.Unix(5, 0), float64Pointer(1),
						}, tp{
							time.Unix(10, 0), nil,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), float64Pointer(1),
					}, tp{
						time.Unix(10, 0), nil,
					}),
				},
			},
		},
		{
			name: "number and series: binary null number and series with non-null and null: is null and null",
			expr: "$A * $B",
			vars: Vars{
				"A": Results{
					[]Value{
						makeNumber("", nil, nil),
					},
				},
				"B": Results{
					[]Value{
						makeSeries("", nil, tp{
							time.Unix(5, 0), float64Pointer(1),
						}, tp{
							time.Unix(10, 0), nil,
						}),
					},
				},
			},
			newErrIs:  assert.NoError,
			execErrIs: assert.NoError,
			results: Results{
				[]Value{
					makeSeries("", nil, tp{
						time.Unix(5, 0), nil,
					}, tp{
						time.Unix(10, 0), nil,
					}),
				},
			},
		},
	}

	// go-cmp instead of testify assert is used to compare results here
	// because it supports an option for NaN equality.
	// https://github.com/stretchr/testify/pull/691#issuecomment-528457166
	opt := cmp.Comparer(func(x, y float64) bool {
		return (math.IsNaN(x) && math.IsNaN(y)) || x == y
	})
	options := append([]cmp.Option{opt}, data.FrameTestCompareOptions()...)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testBlock := func() {
				e, err := New(tt.expr)
				tt.newErrIs(t, err)
				if e != nil {
					res, err := e.Execute("", tt.vars, tracing.NewFakeTracer())
					tt.execErrIs(t, err)
					if diff := cmp.Diff(tt.results, res, options...); diff != "" {
						t.Errorf("Result mismatch (-want +got):\n%s", diff)
					}
				}
			}
			if tt.willPanic {
				assert.Panics(t, testBlock)
			} else {
				testBlock()
			}
		})
	}
}

func TestNoData(t *testing.T) {
	t.Run("unary operation return NoData if input NoData", func(t *testing.T) {
		unaryOps := []string{
			"abs($A)",
			"is_inf($A)",
			"is_nan($A)",
			"is_null($A)",
			"is_number($A)",
			"log($A)",
			"round($A)",
			"ceil($A)",
			"floor($A)",
			"!$A",
			"-$A",
		}
		vars := Vars{"A": Results{[]Value{NewNoData()}}}
		for _, expr := range unaryOps {
			t.Run(fmt.Sprintf("op: %s", expr), func(t *testing.T) {
				e, err := New(expr)
				require.NoError(t, err)
				if e != nil {
					res, err := e.Execute("", vars, tracing.NewFakeTracer())
					require.NoError(t, err)
					require.Len(t, res.Values, 1)
					require.Equal(t, NewNoData(), res.Values[0])
				}
			})
		}
	})

	makeVars := func(a, b Value) Vars {
		return Vars{
			"A": Results{[]Value{a}},
			"B": Results{[]Value{b}},
		}
	}

	bin_ops := []string{
		"$A || $B",
		"$A && $B",
		"$A + $B",
		"$A * $B",
		"$A - $B",
		"$A / $B",
		"$A ** $B",
		"$A % $B",
		"$A == $B",
		"$A > $B",
		"$A != $B",
		"$A < $B",
		"$A >= $B",
		"$A <= $B",
		"$A || $B",
		"$A && $B",
	}
	series := makeSeries("test", nil, tp{time.Unix(5, 0), float64Pointer(2)})
	for _, expr := range bin_ops {
		t.Run(fmt.Sprintf("op: %s", expr), func(t *testing.T) {
			e, err := New(expr)
			require.NoError(t, err)
			if e != nil {
				t.Run("$A,$B=nodata", func(t *testing.T) {
					res, err := e.Execute("", makeVars(NewNoData(), NewNoData()), tracing.NewFakeTracer())
					require.NoError(t, err)
					require.Len(t, res.Values, 1)
					require.Equal(t, NewNoData(), res.Values[0])
				})

				t.Run("$A=nodata, $B=series", func(t *testing.T) {
					res, err := e.Execute("", makeVars(NewNoData(), series), tracing.NewFakeTracer())
					require.NoError(t, err)
					require.Len(t, res.Values, 1)
					require.Equal(t, NewNoData(), res.Values[0])
				})

				t.Run("$A=series, $B=nodata", func(t *testing.T) {
					res, err := e.Execute("", makeVars(NewNoData(), series), tracing.NewFakeTracer())
					require.NoError(t, err)
					require.Len(t, res.Values, 1)
					require.Equal(t, NewNoData(), res.Values[0])
				})
			}
		})
	}
}

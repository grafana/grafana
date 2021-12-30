package mathexp

import (
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Common Test Constructor Utils and Types
type tp struct {
	t time.Time
	f *float64
}

func makeSeries(name string, labels data.Labels, points ...tp) Series {
	newSeries := NewSeries(name, labels, len(points))
	for idx, p := range points {
		newSeries.SetPoint(idx, p.t, p.f)
	}
	return newSeries
}

func makeNumber(name string, labels data.Labels, f *float64) Number {
	newNumber := NewNumber(name, labels)
	newNumber.SetValue(f)
	return newNumber
}

func unixTimePointer(sec, nsec int64) *time.Time {
	t := time.Unix(sec, nsec)
	return &t
}

func float64Pointer(f float64) *float64 {
	return &f
}

func strPointer(s string) *string {
	return &s
}

func int64Pointer(i int64) *int64 {
	return &i
}

func boolPointer(b bool) *bool {
	return &b
}

var aSeries = Vars{
	"A": Results{
		[]Value{
			makeSeries("temp", nil, tp{
				time.Unix(5, 0), float64Pointer(2),
			}, tp{
				time.Unix(10, 0), float64Pointer(1),
			}),
		},
	},
}

var aSeriesbNumber = Vars{
	"A": Results{
		[]Value{
			makeSeries("temp", nil, tp{
				time.Unix(5, 0), float64Pointer(2),
			}, tp{
				time.Unix(10, 0), float64Pointer(1),
			}),
		},
	},
	"B": Results{
		[]Value{
			makeNumber("volt", data.Labels{"id": "1"}, float64Pointer(7)),
		},
	},
}

var twoSeriesSets = Vars{
	"A": Results{
		[]Value{
			makeSeries("temp", data.Labels{"sensor": "a", "turbine": "1"}, tp{
				time.Unix(5, 0), float64Pointer(6),
			}, tp{
				time.Unix(10, 0), float64Pointer(8),
			}),
			makeSeries("temp", data.Labels{"sensor": "b", "turbine": "1"}, tp{
				time.Unix(5, 0), float64Pointer(10),
			}, tp{
				time.Unix(10, 0), float64Pointer(16),
			}),
		},
	},
	"B": Results{
		[]Value{
			makeSeries("efficiency", data.Labels{"turbine": "1"}, tp{
				time.Unix(5, 0), float64Pointer(.5),
			}, tp{
				time.Unix(10, 0), float64Pointer(.2),
			}),
		},
	},
}

// NaN is just to make the calls a little cleaner, the one
// call is not for any sort of equality side effect in tests.
// note: cmp.Equal must be used to test Equality for NaNs.
var NaN = float64Pointer(math.NaN())

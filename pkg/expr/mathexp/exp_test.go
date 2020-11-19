package mathexp

import (
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Common Test Constructor Utils and Types
type nullTimeTP struct {
	t *time.Time
	f *float64
}

type tp struct {
	t time.Time
	f *float64
}

type timeSecondTP struct {
	f *float64
	t time.Time
}

type noNullTP struct {
	t time.Time
	f float64
}

func makeSeriesNullableTime(name string, labels data.Labels, points ...nullTimeTP) Series {
	newSeries := NewSeries(name, labels, 0, true, 1, true, len(points))
	for idx, p := range points {
		_ = newSeries.SetPoint(idx, p.t, p.f)
	}
	return newSeries
}

func makeSeries(name string, labels data.Labels, points ...tp) Series {
	newSeries := NewSeries(name, labels, 0, false, 1, true, len(points))
	for idx, p := range points {
		err := newSeries.SetPoint(idx, &p.t, p.f)
		if err != nil {
			panic(err)
		}
	}
	return newSeries
}

func makeNoNullSeries(name string, labels data.Labels, points ...noNullTP) Series {
	newSeries := NewSeries(name, labels, 0, false, 1, false, len(points))
	for idx, p := range points {
		err := newSeries.SetPoint(idx, &p.t, &p.f)
		if err != nil {
			panic(err)
		}
	}
	return newSeries
}

func makeSeriesTimeSecond(name string, labels data.Labels, points ...timeSecondTP) Series {
	newSeries := NewSeries(name, labels, 1, false, 0, true, len(points))
	for idx, p := range points {
		err := newSeries.SetPoint(idx, &p.t, p.f)
		if err != nil {
			panic(err)
		}
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

var aSeriesNullableTime = Vars{
	"A": Results{
		[]Value{
			makeSeriesNullableTime("temp", nil, nullTimeTP{
				unixTimePointer(5, 0), float64Pointer(2),
			}, nullTimeTP{
				unixTimePointer(10, 0), float64Pointer(1),
			}),
		},
	},
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

var aSeriesTimeSecond = Vars{
	"A": Results{
		[]Value{
			makeSeriesTimeSecond("temp", nil, timeSecondTP{
				float64Pointer(2), time.Unix(5, 0),
			}, timeSecondTP{
				float64Pointer(1), time.Unix(10, 0),
			}),
		},
	},
}

var aSeriesNoNull = Vars{
	"A": Results{
		[]Value{
			makeNoNullSeries("temp", nil, noNullTP{
				time.Unix(5, 0), 2,
			}, noNullTP{
				time.Unix(10, 0), 1,
			}),
		},
	},
}

var aSeriesbNumber = Vars{
	"A": Results{
		[]Value{
			makeSeriesNullableTime("temp", nil, nullTimeTP{
				unixTimePointer(5, 0), float64Pointer(2),
			}, nullTimeTP{
				unixTimePointer(10, 0), float64Pointer(1),
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
			makeSeriesNullableTime("temp", data.Labels{"sensor": "a", "turbine": "1"}, nullTimeTP{
				unixTimePointer(5, 0), float64Pointer(6),
			}, nullTimeTP{
				unixTimePointer(10, 0), float64Pointer(8),
			}),
			makeSeriesNullableTime("temp", data.Labels{"sensor": "b", "turbine": "1"}, nullTimeTP{
				unixTimePointer(5, 0), float64Pointer(10),
			}, nullTimeTP{
				unixTimePointer(10, 0), float64Pointer(16),
			}),
		},
	},
	"B": Results{
		[]Value{
			makeSeriesNullableTime("efficiency", data.Labels{"turbine": "1"}, nullTimeTP{
				unixTimePointer(5, 0), float64Pointer(.5),
			}, nullTimeTP{
				unixTimePointer(10, 0), float64Pointer(.2),
			}),
		},
	},
}

// NaN is just to make the calls a little cleaner, the one
// call is not for any sort of equality side effect in tests.
// note: cmp.Equal must be used to test Equality for NaNs.
var NaN = float64Pointer(math.NaN())

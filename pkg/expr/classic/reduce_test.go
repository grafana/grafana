package classic

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestReducer(t *testing.T) {
	var tests = []struct {
		name           string
		reducer        classicReducer
		inputSeries    mathexp.Series
		expectedNumber mathexp.Number
	}{
		{
			name:           "sum",
			reducer:        classicReducer("sum"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: valBasedNumber(ptr.Float64(6)),
		},
		{
			name:           "min",
			reducer:        classicReducer("min"),
			inputSeries:    valBasedSeries(ptr.Float64(3), ptr.Float64(2), ptr.Float64(1)),
			expectedNumber: valBasedNumber(ptr.Float64(1)),
		},
		{
			name:           "max",
			reducer:        classicReducer("max"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: valBasedNumber(ptr.Float64(3)),
		},
		{
			name:           "count",
			reducer:        classicReducer("count"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3000)),
			expectedNumber: valBasedNumber(ptr.Float64(3)),
		},
		{
			name:           "last",
			reducer:        classicReducer("last"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3000)),
			expectedNumber: valBasedNumber(ptr.Float64(3000)),
		},
		{
			name:           "median with odd amount of numbers",
			reducer:        classicReducer("median"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3000)),
			expectedNumber: valBasedNumber(ptr.Float64(2)),
		},
		{
			name:           "median with even amount of numbers",
			reducer:        classicReducer("median"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(4), ptr.Float64(3000)),
			expectedNumber: valBasedNumber(ptr.Float64(3)),
		},
		{
			name:           "median with one value",
			reducer:        classicReducer("median"),
			inputSeries:    valBasedSeries(ptr.Float64(1)),
			expectedNumber: valBasedNumber(ptr.Float64(1)),
		},
		{
			name:           "median should ignore null values",
			reducer:        classicReducer("median"),
			inputSeries:    valBasedSeries(nil, nil, nil, ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: valBasedNumber(ptr.Float64(2)),
		},
		{
			name:           "avg",
			reducer:        classicReducer("avg"),
			inputSeries:    valBasedSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: valBasedNumber(ptr.Float64(2)),
		},
		{
			name:           "avg with only nulls",
			reducer:        classicReducer("avg"),
			inputSeries:    valBasedSeries(nil),
			expectedNumber: valBasedNumber(nil),
		},
		{
			name:           "avg of number values and null values should ignore nulls",
			reducer:        classicReducer("avg"),
			inputSeries:    valBasedSeries(ptr.Float64(3), nil, nil, ptr.Float64(3)),
			expectedNumber: valBasedNumber(ptr.Float64(3)),
		},
		{
			name:           "count_non_null with mixed null/real values",
			reducer:        classicReducer("count_non_null"),
			inputSeries:    valBasedSeries(nil, nil, ptr.Float64(3), ptr.Float64(4)),
			expectedNumber: valBasedNumber(ptr.Float64(2)),
		},
		{
			name:           "count_non_null with no values",
			reducer:        classicReducer("count_non_null"),
			inputSeries:    valBasedSeries(nil, nil),
			expectedNumber: valBasedNumber(nil),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := tt.reducer.Reduce(tt.inputSeries)
			require.Equal(t, tt.expectedNumber, num)
		})
	}
}

func TestDiffReducer(t *testing.T) {
	var tests = []struct {
		name           string
		inputSeries    mathexp.Series
		expectedNumber mathexp.Number
	}{
		{
			name:           "diff of one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "diff of one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(-30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "diff two positive points (pos result)",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(10)),
		},
		{
			name:           "diff two positive points (neg result)",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: valBasedNumber(ptr.Float64(-10)),
		},
		{
			name:           "diff two negative points (neg result)",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(-10)),
		},
		{
			name:           "diff two negative points (pos result)",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: valBasedNumber(ptr.Float64(20)),
		},
		{
			name:           "diff of one positive and one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(-70)),
		},
		{
			name:           "diff of one negative and one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(70)),
		},
		{
			name:           "diff of three positive points",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: valBasedNumber(ptr.Float64(20)),
		},
		{
			name:           "diff of three negative points",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: valBasedNumber(ptr.Float64(-20)),
		},
		{
			name:           "diff with only nulls",
			inputSeries:    valBasedSeries(nil, nil),
			expectedNumber: valBasedNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := classicReducer("diff").Reduce(tt.inputSeries)
			require.Equal(t, tt.expectedNumber, num)
		})
	}

}

func valBasedSeries(vals ...*float64) mathexp.Series {
	newSeries := mathexp.NewSeries("", nil, 0, false, 1, true, len(vals))
	for idx, f := range vals {
		err := newSeries.SetPoint(idx, unixTimePointer(int64(idx)), f)
		if err != nil {
			panic(err)
		}
	}
	return newSeries
}

func unixTimePointer(sec int64) *time.Time {
	t := time.Unix(sec, 0)
	return &t
}

func valBasedNumber(f *float64) mathexp.Number {
	newNumber := mathexp.NewNumber("", nil)
	newNumber.SetValue(f)
	return newNumber
}

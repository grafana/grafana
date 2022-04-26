package classic

import (
	"math"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
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
			name:           "min with NaNs only",
			reducer:        classicReducer("min"),
			inputSeries:    valBasedSeries(ptr.Float64(math.NaN()), ptr.Float64(math.NaN()), ptr.Float64(math.NaN())),
			expectedNumber: valBasedNumber(nil),
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
			require.Equal(t, true, tt.reducer.ValidReduceFunc())
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
			name:           "diff two positive points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(10)),
		},
		{
			name:           "diff two positive points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: valBasedNumber(ptr.Float64(-10)),
		},
		{
			name:           "diff two negative points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(-10)),
		},
		{
			name:           "diff two negative points [2]",
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

func TestDiffAbsReducer(t *testing.T) {
	var tests = []struct {
		name           string
		inputSeries    mathexp.Series
		expectedNumber mathexp.Number
	}{
		{
			name:           "diff_abs of one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "diff_abs of one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(-30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "diff_abs two positive points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(10)),
		},
		{
			name:           "diff_abs two positive points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: valBasedNumber(ptr.Float64(10)),
		},
		{
			name:           "diff_abs two negative points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(10)),
		},
		{
			name:           "diff_abs two negative points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: valBasedNumber(ptr.Float64(20)),
		},
		{
			name:           "diff_abs of one positive and one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(70)),
		},
		{
			name:           "diff_abs of one negative and one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(70)),
		},
		{
			name:           "diff_abs of three positive points",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: valBasedNumber(ptr.Float64(20)),
		},
		{
			name:           "diff_abs of three negative points",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: valBasedNumber(ptr.Float64(20)),
		},
		{
			name:           "diff_abs with only nulls",
			inputSeries:    valBasedSeries(nil, nil),
			expectedNumber: valBasedNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := classicReducer("diff_abs").Reduce(tt.inputSeries)
			require.Equal(t, tt.expectedNumber, num)
		})
	}
}

func TestPercentDiffReducer(t *testing.T) {
	var tests = []struct {
		name           string
		inputSeries    mathexp.Series
		expectedNumber mathexp.Number
	}{
		{
			name:           "percent_diff of one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff of one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(-30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff two positive points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff two positive points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: valBasedNumber(ptr.Float64(-33.33333333333333)),
		},
		{
			name:           "percent_diff two negative points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(-33.33333333333333)),
		},
		{
			name:           "percent_diff two negative points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: valBasedNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff of one positive and one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(-233.33333333333334)),
		},
		{
			name:           "percent_diff of one negative and one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(233.33333333333334)),
		},
		{
			name:           "percent_diff of three positive points",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: valBasedNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff of three negative points",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: valBasedNumber(ptr.Float64(-66.66666666666666)),
		},
		{
			name:           "percent_diff with only nulls",
			inputSeries:    valBasedSeries(nil, nil),
			expectedNumber: valBasedNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := classicReducer("percent_diff").Reduce(tt.inputSeries)
			require.Equal(t, tt.expectedNumber, num)
		})
	}
}

func TestPercentDiffAbsReducer(t *testing.T) {
	var tests = []struct {
		name           string
		inputSeries    mathexp.Series
		expectedNumber mathexp.Number
	}{
		{
			name:           "percent_diff_abs of one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff_abs of one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(-30)),
			expectedNumber: valBasedNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff_abs two positive points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two positive points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: valBasedNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two negative points [1]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two negative points [2]",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: valBasedNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs of one positive and one negative point",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: valBasedNumber(ptr.Float64(233.33333333333334)),
		},
		{
			name:           "percent_diff_abs of one negative and one positive point",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: valBasedNumber(ptr.Float64(233.33333333333334)),
		},
		{
			name:           "percent_diff_abs of three positive points",
			inputSeries:    valBasedSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: valBasedNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs of three negative points",
			inputSeries:    valBasedSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: valBasedNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs with only nulls",
			inputSeries:    valBasedSeries(nil, nil),
			expectedNumber: valBasedNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := classicReducer("percent_diff_abs").Reduce(tt.inputSeries)
			require.Equal(t, tt.expectedNumber, num)
		})
	}
}

func valBasedSeries(vals ...*float64) mathexp.Series {
	newSeries := mathexp.NewSeries("", nil, len(vals))
	for idx, f := range vals {
		newSeries.SetPoint(idx, time.Unix(int64(idx), 0), f)
	}
	return newSeries
}

func valBasedSeriesWithLabels(l data.Labels, vals ...*float64) mathexp.Series {
	newSeries := mathexp.NewSeries("", l, len(vals))
	for idx, f := range vals {
		newSeries.SetPoint(idx, time.Unix(int64(idx), 0), f)
	}
	return newSeries
}

func valBasedNumber(f *float64) mathexp.Number {
	newNumber := mathexp.NewNumber("", nil)
	newNumber.SetValue(f)
	return newNumber
}

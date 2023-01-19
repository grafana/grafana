package classic

import (
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func TestReducer(t *testing.T) {
	var tests = []struct {
		name           string
		reducer        reducer
		inputSeries    mathexp.Series
		expectedNumber mathexp.Number
	}{
		{
			name:           "sum",
			reducer:        reducer("sum"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: newNumber(ptr.Float64(6)),
		},
		{
			name:           "min",
			reducer:        reducer("min"),
			inputSeries:    newSeries(ptr.Float64(3), ptr.Float64(2), ptr.Float64(1)),
			expectedNumber: newNumber(ptr.Float64(1)),
		},
		{
			name:           "min with NaNs only",
			reducer:        reducer("min"),
			inputSeries:    newSeries(ptr.Float64(math.NaN()), ptr.Float64(math.NaN()), ptr.Float64(math.NaN())),
			expectedNumber: newNumber(nil),
		},
		{
			name:           "max",
			reducer:        reducer("max"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: newNumber(ptr.Float64(3)),
		},
		{
			name:           "count",
			reducer:        reducer("count"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3000)),
			expectedNumber: newNumber(ptr.Float64(3)),
		},
		{
			name:           "last",
			reducer:        reducer("last"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3000)),
			expectedNumber: newNumber(ptr.Float64(3000)),
		},
		{
			name:           "median with odd amount of numbers",
			reducer:        reducer("median"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3000)),
			expectedNumber: newNumber(ptr.Float64(2)),
		},
		{
			name:           "median with even amount of numbers",
			reducer:        reducer("median"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(4), ptr.Float64(3000)),
			expectedNumber: newNumber(ptr.Float64(3)),
		},
		{
			name:           "median with one value",
			reducer:        reducer("median"),
			inputSeries:    newSeries(ptr.Float64(1)),
			expectedNumber: newNumber(ptr.Float64(1)),
		},
		{
			name:           "median should ignore null values",
			reducer:        reducer("median"),
			inputSeries:    newSeries(nil, nil, nil, ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: newNumber(ptr.Float64(2)),
		},
		{
			name:           "avg",
			reducer:        reducer("avg"),
			inputSeries:    newSeries(ptr.Float64(1), ptr.Float64(2), ptr.Float64(3)),
			expectedNumber: newNumber(ptr.Float64(2)),
		},
		{
			name:           "avg with only nulls",
			reducer:        reducer("avg"),
			inputSeries:    newSeries(nil),
			expectedNumber: newNumber(nil),
		},
		{
			name:           "avg of number values and null values should ignore nulls",
			reducer:        reducer("avg"),
			inputSeries:    newSeries(ptr.Float64(3), nil, nil, ptr.Float64(3)),
			expectedNumber: newNumber(ptr.Float64(3)),
		},
		{
			name:           "count_non_null with mixed null/real values",
			reducer:        reducer("count_non_null"),
			inputSeries:    newSeries(nil, nil, ptr.Float64(3), ptr.Float64(4)),
			expectedNumber: newNumber(ptr.Float64(2)),
		},
		{
			name:           "count_non_null with mixed null/real values",
			reducer:        reducer("count_non_null"),
			inputSeries:    newSeries(nil, nil, ptr.Float64(3), ptr.Float64(4)),
			expectedNumber: newNumber(ptr.Float64(2)),
		},
		{
			name:           "count_non_null with no values",
			reducer:        reducer("count_non_null"),
			inputSeries:    newSeries(nil, nil),
			expectedNumber: newNumber(nil),
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
			inputSeries:    newSeries(ptr.Float64(30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "diff of one negative point",
			inputSeries:    newSeries(ptr.Float64(-30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "diff two positive points [1]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(10)),
		},
		{
			name:           "diff two positive points [2]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: newNumber(ptr.Float64(-10)),
		},
		{
			name:           "diff two negative points [1]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(-10)),
		},
		{
			name:           "diff two negative points [2]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: newNumber(ptr.Float64(20)),
		},
		{
			name:           "diff of one positive and one negative point",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(-70)),
		},
		{
			name:           "diff of one negative and one positive point",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(70)),
		},
		{
			name:           "diff of three positive points",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: newNumber(ptr.Float64(20)),
		},
		{
			name:           "diff of three negative points",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: newNumber(ptr.Float64(-20)),
		},
		{
			name:           "diff with only nulls",
			inputSeries:    newSeries(nil, nil),
			expectedNumber: newNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := reducer("diff").Reduce(tt.inputSeries)
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
			inputSeries:    newSeries(ptr.Float64(30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "diff_abs of one negative point",
			inputSeries:    newSeries(ptr.Float64(-30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "diff_abs two positive points [1]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(10)),
		},
		{
			name:           "diff_abs two positive points [2]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: newNumber(ptr.Float64(10)),
		},
		{
			name:           "diff_abs two negative points [1]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(10)),
		},
		{
			name:           "diff_abs two negative points [2]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: newNumber(ptr.Float64(20)),
		},
		{
			name:           "diff_abs of one positive and one negative point",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(70)),
		},
		{
			name:           "diff_abs of one negative and one positive point",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(70)),
		},
		{
			name:           "diff_abs of three positive points",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: newNumber(ptr.Float64(20)),
		},
		{
			name:           "diff_abs of three negative points",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: newNumber(ptr.Float64(20)),
		},
		{
			name:           "diff_abs with only nulls",
			inputSeries:    newSeries(nil, nil),
			expectedNumber: newNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := reducer("diff_abs").Reduce(tt.inputSeries)
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
			inputSeries:    newSeries(ptr.Float64(30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff of one negative point",
			inputSeries:    newSeries(ptr.Float64(-30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff two positive points [1]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff two positive points [2]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: newNumber(ptr.Float64(-33.33333333333333)),
		},
		{
			name:           "percent_diff two negative points [1]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(-33.33333333333333)),
		},
		{
			name:           "percent_diff two negative points [2]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: newNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff of one positive and one negative point",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(-233.33333333333334)),
		},
		{
			name:           "percent_diff of one negative and one positive point",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(233.33333333333334)),
		},
		{
			name:           "percent_diff of three positive points",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: newNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff of three negative points",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: newNumber(ptr.Float64(-66.66666666666666)),
		},
		{
			name:           "percent_diff with only nulls",
			inputSeries:    newSeries(nil, nil),
			expectedNumber: newNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := reducer("percent_diff").Reduce(tt.inputSeries)
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
			inputSeries:    newSeries(ptr.Float64(30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff_abs of one negative point",
			inputSeries:    newSeries(ptr.Float64(-30)),
			expectedNumber: newNumber(ptr.Float64(0)),
		},
		{
			name:           "percent_diff_abs two positive points [1]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two positive points [2]",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(20)),
			expectedNumber: newNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two negative points [1]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two negative points [2]",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-10)),
			expectedNumber: newNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs of one positive and one negative point",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(-40)),
			expectedNumber: newNumber(ptr.Float64(233.33333333333334)),
		},
		{
			name:           "percent_diff_abs of one negative and one positive point",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(40)),
			expectedNumber: newNumber(ptr.Float64(233.33333333333334)),
		},
		{
			name:           "percent_diff_abs of three positive points",
			inputSeries:    newSeries(ptr.Float64(30), ptr.Float64(40), ptr.Float64(50)),
			expectedNumber: newNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs of three negative points",
			inputSeries:    newSeries(ptr.Float64(-30), ptr.Float64(-40), ptr.Float64(-50)),
			expectedNumber: newNumber(ptr.Float64(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs with only nulls",
			inputSeries:    newSeries(nil, nil),
			expectedNumber: newNumber(nil),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			num := reducer("percent_diff_abs").Reduce(tt.inputSeries)
			require.Equal(t, tt.expectedNumber, num)
		})
	}
}

func newNumber(f *float64) mathexp.Number {
	num := mathexp.NewNumber("", nil)
	num.SetValue(f)
	return num
}

func newSeries(points ...*float64) mathexp.Series {
	series := mathexp.NewSeries("", nil, len(points))
	for idx, point := range points {
		series.SetPoint(idx, time.Unix(int64(idx), 0), point)
	}
	return series
}

func newSeriesWithLabels(labels data.Labels, values ...*float64) mathexp.Series {
	series := mathexp.NewSeries("", labels, len(values))
	for idx, value := range values {
		series.SetPoint(idx, time.Unix(int64(idx), 0), value)
	}
	return series
}

func newResults(values ...mathexp.Value) mathexp.Results {
	return mathexp.Results{Values: values}
}

package classic

import (
	"math"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/util"
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
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3.0)),
			expectedNumber: newNumber(util.Pointer(6.0)),
		},
		{
			name:           "min",
			reducer:        reducer("min"),
			inputSeries:    newSeries(util.Pointer(3.0), util.Pointer(2.0), util.Pointer(1.0)),
			expectedNumber: newNumber(util.Pointer(1.0)),
		},
		{
			name:           "min with NaNs only",
			reducer:        reducer("min"),
			inputSeries:    newSeries(util.Pointer(math.NaN()), util.Pointer(math.NaN()), util.Pointer(math.NaN())),
			expectedNumber: newNumber(nil),
		},
		{
			name:           "max",
			reducer:        reducer("max"),
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3.0)),
			expectedNumber: newNumber(util.Pointer(3.0)),
		},
		{
			name:           "count",
			reducer:        reducer("count"),
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3000.0)),
			expectedNumber: newNumber(util.Pointer(3.0)),
		},
		{
			name:           "last",
			reducer:        reducer("last"),
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3000.0)),
			expectedNumber: newNumber(util.Pointer(3000.0)),
		},
		{
			name:           "median with odd amount of numbers",
			reducer:        reducer("median"),
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3000.0)),
			expectedNumber: newNumber(util.Pointer(2.0)),
		},
		{
			name:           "median with even amount of numbers",
			reducer:        reducer("median"),
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(4.0), util.Pointer(3000.0)),
			expectedNumber: newNumber(util.Pointer(3.0)),
		},
		{
			name:           "median with one value",
			reducer:        reducer("median"),
			inputSeries:    newSeries(util.Pointer(1.0)),
			expectedNumber: newNumber(util.Pointer(1.0)),
		},
		{
			name:           "median should ignore null values",
			reducer:        reducer("median"),
			inputSeries:    newSeries(nil, nil, nil, util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3.0)),
			expectedNumber: newNumber(util.Pointer(2.0)),
		},
		{
			name:           "avg",
			reducer:        reducer("avg"),
			inputSeries:    newSeries(util.Pointer(1.0), util.Pointer(2.0), util.Pointer(3.0)),
			expectedNumber: newNumber(util.Pointer(2.0)),
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
			inputSeries:    newSeries(util.Pointer(3.0), nil, nil, util.Pointer(3.0)),
			expectedNumber: newNumber(util.Pointer(3.0)),
		},
		{
			name:           "count_non_null with mixed null/real values",
			reducer:        reducer("count_non_null"),
			inputSeries:    newSeries(nil, nil, util.Pointer(3.0), util.Pointer(4.0)),
			expectedNumber: newNumber(util.Pointer(2.0)),
		},
		{
			name:           "count_non_null with mixed null/real values",
			reducer:        reducer("count_non_null"),
			inputSeries:    newSeries(nil, nil, util.Pointer(3.0), util.Pointer(4.0)),
			expectedNumber: newNumber(util.Pointer(2.0)),
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
			inputSeries:    newSeries(util.Pointer(30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "diff of one negative point",
			inputSeries:    newSeries(util.Pointer(-30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "diff two positive points [1]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(10.0)),
		},
		{
			name:           "diff two positive points [2]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(20.0)),
			expectedNumber: newNumber(util.Pointer(-10.0)),
		},
		{
			name:           "diff two negative points [1]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(-10.0)),
		},
		{
			name:           "diff two negative points [2]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-10.0)),
			expectedNumber: newNumber(util.Pointer(20.0)),
		},
		{
			name:           "diff of one positive and one negative point",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(-70.0)),
		},
		{
			name:           "diff of one negative and one positive point",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(70.0)),
		},
		{
			name:           "diff of three positive points",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0), util.Pointer(50.0)),
			expectedNumber: newNumber(util.Pointer(20.0)),
		},
		{
			name:           "diff of three negative points",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0), util.Pointer(-50.0)),
			expectedNumber: newNumber(util.Pointer(-20.0)),
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
			inputSeries:    newSeries(util.Pointer(30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "diff_abs of one negative point",
			inputSeries:    newSeries(util.Pointer(-30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "diff_abs two positive points [1]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(10.0)),
		},
		{
			name:           "diff_abs two positive points [2]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(20.0)),
			expectedNumber: newNumber(util.Pointer(10.0)),
		},
		{
			name:           "diff_abs two negative points [1]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(10.0)),
		},
		{
			name:           "diff_abs two negative points [2]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-10.0)),
			expectedNumber: newNumber(util.Pointer(20.0)),
		},
		{
			name:           "diff_abs of one positive and one negative point",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(70.0)),
		},
		{
			name:           "diff_abs of one negative and one positive point",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(70.0)),
		},
		{
			name:           "diff_abs of three positive points",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0), util.Pointer(50.0)),
			expectedNumber: newNumber(util.Pointer(20.0)),
		},
		{
			name:           "diff_abs of three negative points",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0), util.Pointer(-50.0)),
			expectedNumber: newNumber(util.Pointer(20.0)),
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
			inputSeries:    newSeries(util.Pointer(30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "percent_diff of one negative point",
			inputSeries:    newSeries(util.Pointer(-30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "percent_diff two positive points [1]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(33.33333333333333)),
		},
		{
			name:           "percent_diff two positive points [2]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(20.0)),
			expectedNumber: newNumber(util.Pointer(-33.33333333333333)),
		},
		{
			name:           "percent_diff two negative points [1]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(-33.33333333333333)),
		},
		{
			name:           "percent_diff two negative points [2]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-10.0)),
			expectedNumber: newNumber(util.Pointer(66.66666666666666)),
		},
		{
			name:           "percent_diff of one positive and one negative point",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(-233.33333333333334)),
		},
		{
			name:           "percent_diff of one negative and one positive point",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(233.33333333333334)),
		},
		{
			name:           "percent_diff of three positive points",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0), util.Pointer(50.0)),
			expectedNumber: newNumber(util.Pointer(66.66666666666666)),
		},
		{
			name:           "percent_diff of three negative points",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0), util.Pointer(-50.0)),
			expectedNumber: newNumber(util.Pointer(-66.66666666666666)),
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
			inputSeries:    newSeries(util.Pointer(30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "percent_diff_abs of one negative point",
			inputSeries:    newSeries(util.Pointer(-30.0)),
			expectedNumber: newNumber(util.Pointer(0.0)),
		},
		{
			name:           "percent_diff_abs two positive points [1]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two positive points [2]",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(20.0)),
			expectedNumber: newNumber(util.Pointer(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two negative points [1]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(33.33333333333333)),
		},
		{
			name:           "percent_diff_abs two negative points [2]",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-10.0)),
			expectedNumber: newNumber(util.Pointer(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs of one positive and one negative point",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(-40.0)),
			expectedNumber: newNumber(util.Pointer(233.33333333333334)),
		},
		{
			name:           "percent_diff_abs of one negative and one positive point",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(40.0)),
			expectedNumber: newNumber(util.Pointer(233.33333333333334)),
		},
		{
			name:           "percent_diff_abs of three positive points",
			inputSeries:    newSeries(util.Pointer(30.0), util.Pointer(40.0), util.Pointer(50.0)),
			expectedNumber: newNumber(util.Pointer(66.66666666666666)),
		},
		{
			name:           "percent_diff_abs of three negative points",
			inputSeries:    newSeries(util.Pointer(-30.0), util.Pointer(-40.0), util.Pointer(-50.0)),
			expectedNumber: newNumber(util.Pointer(66.66666666666666)),
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

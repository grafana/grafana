package classic

import (
	"math"
	"sort"

	"github.com/grafana/grafana/pkg/expr/mathexp"
)

func nilOrNaN(f *float64) bool {
	return f == nil || math.IsNaN(*f)
}

func (cr classicReducer) ValidReduceFunc() bool {
	switch cr {
	case "avg", "sum", "min", "max", "count", "last", "median":
		return true
	case "diff", "diff_abs", "percent_diff", "percent_diff_abs", "count_non_null":
		return true
	}
	return false
}

//nolint:gocyclo
func (cr classicReducer) Reduce(series mathexp.Series) mathexp.Number {
	num := mathexp.NewNumber("", nil)

	if series.GetLabels() != nil {
		num.SetLabels(series.GetLabels().Copy())
	}

	num.SetValue(nil)

	if series.Len() == 0 {
		return num
	}

	value := float64(0)
	allNull := true

	vF := series.Frame.Fields[1]
	ff := mathexp.Float64Field(*vF)

	switch cr {
	case "avg":
		validPointsCount := 0
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if nilOrNaN(f) {
				continue
			}
			value += *f
			validPointsCount++
			allNull = false
		}
		if validPointsCount > 0 {
			value /= float64(validPointsCount)
		}
	case "sum":
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if nilOrNaN(f) {
				continue
			}
			value += *f
			allNull = false
		}
	case "min":
		value = math.MaxFloat64
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if nilOrNaN(f) {
				continue
			}
			allNull = false
			if value > *f {
				value = *f
			}
		}
		if allNull {
			value = 0
		}
	case "max":
		value = -math.MaxFloat64
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if nilOrNaN(f) {
				continue
			}
			allNull = false
			if value < *f {
				value = *f
			}
		}
		if allNull {
			value = 0
		}
	case "count":
		value = float64(ff.Len())
		allNull = false
	case "last":
		for i := ff.Len() - 1; i >= 0; i-- {
			f := ff.GetValue(i)
			if !nilOrNaN(f) {
				value = *f
				allNull = false
				break
			}
		}
	case "median":
		var values []float64
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if nilOrNaN(f) {
				continue
			}
			allNull = false
			values = append(values, *f)
		}
		if len(values) >= 1 {
			sort.Float64s(values)
			length := len(values)
			if length%2 == 1 {
				value = values[(length-1)/2]
			} else {
				value = (values[(length/2)-1] + values[length/2]) / 2
			}
		}
	case "diff":
		allNull, value = calculateDiff(ff, allNull, value, diff)
	case "diff_abs":
		allNull, value = calculateDiff(ff, allNull, value, diffAbs)
	case "percent_diff":
		allNull, value = calculateDiff(ff, allNull, value, percentDiff)
	case "percent_diff_abs":
		allNull, value = calculateDiff(ff, allNull, value, percentDiffAbs)
	case "count_non_null":
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if nilOrNaN(f) {
				continue
			}
			value++
		}

		if value > 0 {
			allNull = false
		}
	}

	if allNull {
		return num
	}

	num.SetValue(&value)
	return num
}

func calculateDiff(ff mathexp.Float64Field, allNull bool, value float64, fn func(float64, float64) float64) (bool, float64) {
	var (
		first float64
		i     int
	)
	// get the newest point
	for i = ff.Len() - 1; i >= 0; i-- {
		f := ff.GetValue(i)
		if !nilOrNaN(f) {
			first = *f
			allNull = false
			break
		}
	}
	if i >= 1 {
		// get the oldest point
		for i := 0; i < ff.Len(); i++ {
			f := ff.GetValue(i)
			if !nilOrNaN(f) {
				value = fn(first, *f)
				allNull = false
				break
			}
		}
	}
	return allNull, value
}

var diff = func(newest, oldest float64) float64 {
	return newest - oldest
}

var diffAbs = func(newest, oldest float64) float64 {
	return math.Abs(newest - oldest)
}

var percentDiff = func(newest, oldest float64) float64 {
	return (newest - oldest) / math.Abs(oldest) * 100
}

var percentDiffAbs = func(newest, oldest float64) float64 {
	return math.Abs((newest - oldest) / oldest * 100)
}

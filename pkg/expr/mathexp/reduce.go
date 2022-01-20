package mathexp

import (
	"fmt"
	"math"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ReducerFunc = func(fv *Float64Field) *float64

func Sum(fv *Float64Field) *float64 {
	var sum float64
	for i := 0; i < fv.Len(); i++ {
		f := fv.GetValue(i)
		if f == nil || math.IsNaN(*f) {
			nan := math.NaN()
			return &nan
		}
		sum += *f
	}
	return &sum
}

func Avg(fv *Float64Field) *float64 {
	sum := Sum(fv)
	f := *sum / float64(fv.Len())
	return &f
}

func Min(fv *Float64Field) *float64 {
	var f float64
	if fv.Len() == 0 {
		nan := math.NaN()
		return &nan
	}
	for i := 0; i < fv.Len(); i++ {
		v := fv.GetValue(i)
		if v == nil || math.IsNaN(*v) {
			nan := math.NaN()
			return &nan
		}
		if i == 0 || *v < f {
			f = *v
		}
	}
	return &f
}

func Max(fv *Float64Field) *float64 {
	var f float64
	if fv.Len() == 0 {
		nan := math.NaN()
		return &nan
	}
	for i := 0; i < fv.Len(); i++ {
		v := fv.GetValue(i)
		if v == nil || math.IsNaN(*v) {
			nan := math.NaN()
			return &nan
		}
		if i == 0 || *v > f {
			f = *v
		}
	}
	return &f
}

func Count(fv *Float64Field) *float64 {
	f := float64(fv.Len())
	return &f
}

func Last(fv *Float64Field) *float64 {
	var f float64
	if fv.Len() == 0 {
		f = math.NaN()
		return &f
	}
	v := fv.GetValue(fv.Len() - 1)
	f = *v
	return &f
}

const ReduceModeDropNN = "dropNN"

func GetReduceFunc(rFunc string) (ReducerFunc, error) {
	switch strings.ToLower(rFunc) {
	case "sum":
		return Sum, nil
	case "mean":
		return Avg, nil
	case "min":
		return Min, nil
	case "max":
		return Max, nil
	case "count":
		return Count, nil
	case "last":
		return Last, nil
	default:
		return nil, fmt.Errorf("reduction %v not implemented", rFunc)
	}
}

// Reduce turns the Series into a Number based on the given reduction function
// When mode is not set, generally reductions on empty series (or series with NaN/null values) (with the exception of count)
// return NaN.
// When mode is set to Drop Non-Number "dropNN" (eww.. make some constants) then all NaN/Inf/Null values are removed from the series
// before the reduction is performed, and if the resulting series is empty then null is returned from the reduction.
func (s Series) Reduce(refID, rFunc string, mode string) (Number, error) {
	var l data.Labels
	if s.GetLabels() != nil {
		l = s.GetLabels().Copy()
	}
	number := NewNumber(refID, l)
	var f *float64
	fVec := s.Frame.Fields[seriesTypeValIdx]
	if mode == ReduceModeDropNN {
		fVec = s.filterNonNumber().Frame.Fields[seriesTypeValIdx]
	}
	floatField := Float64Field(*fVec)
	reduceFunc, err := GetReduceFunc(rFunc)
	if err != nil {
		return number, err
	}
	f = reduceFunc(&floatField)
	if mode == ReduceModeDropNN && f != nil && math.IsNaN(*f) {
		f = nil
	}
	number.SetValue(f)

	return number, nil
}

func (s Series) filterNonNumber() Series {
	newSeries := NewSeries(s.Frame.RefID, s.GetLabels(), 0)
	for i := 0; i < s.Len(); i++ {
		f := s.GetValue(i)
		if f == nil || math.IsNaN(*f) || math.IsInf(*f, 0) {
			continue
		}
		newFloat := *f
		newSeries.AppendPoint(s.GetTime(i), &newFloat)
	}
	return newSeries
}

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
// if ValueMapper is defined it applies it to the provided series and performs reduction of the resulting series.
// Otherwise, the reduction operation is done against the original series.
func (s Series) Reduce(refID, rFunc string, mapper ValueMapper) (Number, error) {
	var l data.Labels
	if s.GetLabels() != nil {
		l = s.GetLabels().Copy()
	}
	number := NewNumber(refID, l)
	var f *float64
	series := s
	if mapper != nil {
		series = mapper.MapSeries(s)
	}
	fVec := series.Frame.Fields[seriesTypeValIdx]
	floatField := Float64Field(*fVec)
	reduceFunc, err := GetReduceFunc(rFunc)
	if err != nil {
		return number, err
	}
	f = reduceFunc(&floatField)
	if f != nil && mapper != nil {
		f = mapper.MapResult(f)
	}
	number.SetValue(f)
	return number, nil
}

type ValueMapper interface {
	MapSeries(s Series) Series
	MapResult(v *float64) *float64
}

type DropNonNumber struct {
}

// MapSeries creates a series that contains all points of the input series except non numbers (nil, NaN or Inf)
func (d DropNonNumber) MapSeries(s Series) Series {
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

func (d DropNonNumber) MapResult(v *float64) *float64 {
	if v != nil && math.IsNaN(*v) {
		return nil
	}
	return v
}

type ReplaceNonNumberWithValue struct {
	Value float64
}

// MapSeries create a function that creates a series where all points that have non-number value replaced with constant value
func (r ReplaceNonNumberWithValue) MapSeries(s Series) Series {
	newSeries := NewSeries(s.Frame.RefID, s.GetLabels(), 0)
	for i := 0; i < s.Len(); i++ {
		f := s.GetValue(i)
		var newFloat float64
		if f == nil || math.IsNaN(*f) || math.IsInf(*f, 0) {
			newFloat = r.Value
		} else {
			newFloat = *f
		}
		newSeries.AppendPoint(s.GetTime(i), &newFloat)
	}
	return newSeries
}

func (r ReplaceNonNumberWithValue) MapResult(v *float64) *float64 {
	if v != nil && math.IsNaN(*v) {
		result := r.Value
		return &result
	}
	return v
}

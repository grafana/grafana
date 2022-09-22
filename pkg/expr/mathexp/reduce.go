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
	return fv.GetValue(fv.Len() - 1)
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

// GetSupportedReduceFuncs returns collection of supported function names
func GetSupportedReduceFuncs() []string {
	return []string{"sum", "mean", "min", "max", "count", "last"}
}

// Reduce turns the Series into a Number based on the given reduction function
// if ReduceMapper is defined it applies it to the provided series and performs reduction of the resulting series.
// Otherwise, the reduction operation is done against the original series.
func (s Series) Reduce(refID, rFunc string, mapper ReduceMapper) (Number, error) {
	var l data.Labels
	if s.GetLabels() != nil {
		l = s.GetLabels().Copy()
	}
	number := NewNumber(refID, l)
	var f *float64
	series := s
	if mapper != nil {
		series = mapSeries(s, mapper)
	}
	fVec := series.Frame.Fields[seriesTypeValIdx]
	floatField := Float64Field(*fVec)
	reduceFunc, err := GetReduceFunc(rFunc)
	if err != nil {
		return number, fmt.Errorf("invalid expression '%s': %w", refID, err)
	}
	f = reduceFunc(&floatField)
	if f != nil && mapper != nil {
		f = mapper.MapOutput(f)
	}
	number.SetValue(f)
	return number, nil
}

type ReduceMapper interface {
	MapInput(s *float64) *float64
	MapOutput(v *float64) *float64
}

// mapSeries creates a series where all points are mapped using the provided map function ReduceMapper.MapInput
func mapSeries(s Series, mapper ReduceMapper) Series {
	newSeries := NewSeries(s.Frame.RefID, s.GetLabels(), 0)
	for i := 0; i < s.Len(); i++ {
		f := s.GetValue(i)
		f = mapper.MapInput(f)
		if f == nil {
			continue
		}
		newFloat := *f
		newSeries.AppendPoint(s.GetTime(i), &newFloat)
	}
	return newSeries
}

type DropNonNumber struct {
}

// MapInput returns nil if the input parameter is nil or point to either a NaN or a Inf
func (d DropNonNumber) MapInput(s *float64) *float64 {
	if s == nil || math.IsNaN(*s) || math.IsInf(*s, 0) {
		return nil
	}
	return s
}

// MapOutput returns nil if the input parameter is nil or point to either a NaN or a Inf
func (d DropNonNumber) MapOutput(s *float64) *float64 {
	if s != nil && math.IsNaN(*s) {
		return nil
	}
	return s
}

type ReplaceNonNumberWithValue struct {
	Value float64
}

// MapInput returns a pointer to ReplaceNonNumberWithValue.Value if input parameter is nil or points to either a NaN or an Inf.
// Otherwise, returns the input pointer as is.
func (r ReplaceNonNumberWithValue) MapInput(v *float64) *float64 {
	if v == nil || math.IsNaN(*v) || math.IsInf(*v, 0) {
		return &r.Value
	} else {
		return v
	}
}

// MapOutput returns a pointer to ReplaceNonNumberWithValue.Value if input parameter is nil or points to either a NaN or an Inf.
// Otherwise, returns the input pointer as is.
func (r ReplaceNonNumberWithValue) MapOutput(s *float64) *float64 {
	if s != nil && math.IsNaN(*s) {
		return &r.Value
	}
	return s
}

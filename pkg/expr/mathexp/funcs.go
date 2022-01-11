package mathexp

import (
	"math"

	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
)

var builtins = map[string]parse.Func{
	"abs": {
		Args:          []parse.ReturnType{parse.TypeVariantSet},
		VariantReturn: true,
		F:             abs,
	},
	"log": {
		Args:          []parse.ReturnType{parse.TypeVariantSet},
		VariantReturn: true,
		F:             log,
	},
	"nan": {
		Return: parse.TypeScalar,
		F:      nan,
	},
	"is_nan": {
		Args:          []parse.ReturnType{parse.TypeVariantSet},
		VariantReturn: true,
		F:             isNaN,
	},
	"inf": {
		Return: parse.TypeScalar,
		F:      inf,
	},
	"infn": {
		Return: parse.TypeScalar,
		F:      infn,
	},
	"is_inf": {
		Args:          []parse.ReturnType{parse.TypeVariantSet},
		VariantReturn: true,
		F:             isInf,
	},
	"null": {
		Return: parse.TypeScalar,
		F:      null,
	},
	"is_null": {
		Args:          []parse.ReturnType{parse.TypeVariantSet},
		VariantReturn: true,
		F:             isNull,
	},
	"is_number": {
		Args:          []parse.ReturnType{parse.TypeVariantSet},
		VariantReturn: true,
		F:             isNumber,
	},
}

// abs returns the absolute value for each result in NumberSet, SeriesSet, or Scalar
func abs(e *State, varSet Results) (Results, error) {
	newRes := Results{}
	for _, res := range varSet.Values {
		newVal, err := perFloat(e, res, math.Abs)
		if err != nil {
			return newRes, err
		}
		newRes.Values = append(newRes.Values, newVal)
	}
	return newRes, nil
}

// log returns the natural logarithm value for each result in NumberSet, SeriesSet, or Scalar
func log(e *State, varSet Results) (Results, error) {
	newRes := Results{}
	for _, res := range varSet.Values {
		newVal, err := perFloat(e, res, math.Log)
		if err != nil {
			return newRes, err
		}
		newRes.Values = append(newRes.Values, newVal)
	}
	return newRes, nil
}

// isNaN returns 1 if the value for each result in NumberSet, SeriesSet, or Scalar is NaN, else 0.
func isNaN(e *State, varSet Results) (Results, error) {
	newRes := Results{}
	for _, res := range varSet.Values {
		newVal, err := perFloat(e, res, func(f float64) float64 {
			if math.IsNaN(f) {
				return 1
			}
			return 0
		})
		if err != nil {
			return newRes, err
		}
		newRes.Values = append(newRes.Values, newVal)
	}
	return newRes, nil
}

// isInf returns 1 if the value for each result in NumberSet, SeriesSet, or Scalar is a
// positive or negative Inf, else 0.
func isInf(e *State, varSet Results) (Results, error) {
	newRes := Results{}
	for _, res := range varSet.Values {
		newVal, err := perFloat(e, res, func(f float64) float64 {
			if math.IsInf(f, 0) {
				return 1
			}
			return 0
		})
		if err != nil {
			return newRes, err
		}
		newRes.Values = append(newRes.Values, newVal)
	}
	return newRes, nil
}

// nan returns a scalar nan value
func nan(e *State) Results {
	aNaN := math.NaN()
	return NewScalarResults(e.RefID, &aNaN)
}

// inf returns a scalar positive infinity value
func inf(e *State) Results {
	aInf := math.Inf(0)
	return NewScalarResults(e.RefID, &aInf)
}

// infn returns a scalar negative infinity value
func infn(e *State) Results {
	aInf := math.Inf(-1)
	return NewScalarResults(e.RefID, &aInf)
}

// null returns a null scalar value
func null(e *State) Results {
	return NewScalarResults(e.RefID, nil)
}

// isNull returns 1 if the value for each result in NumberSet, SeriesSet, or Scalar is null, else 0.
func isNull(e *State, varSet Results) (Results, error) {
	newRes := Results{}
	for _, res := range varSet.Values {
		newVal, err := perNullableFloat(e, res, func(f *float64) *float64 {
			nF := float64(0)
			if f == nil {
				nF = 1
			}
			return &nF
		})
		if err != nil {
			return newRes, err
		}
		newRes.Values = append(newRes.Values, newVal)
	}
	return newRes, nil
}

// isNumber returns 1 if the value for each result in NumberSet, SeriesSet, or Scalar is a real number, else 0.
// Therefore 0 is returned if the value Inf+, Inf-, NaN, or Null.
func isNumber(e *State, varSet Results) (Results, error) {
	newRes := Results{}
	for _, res := range varSet.Values {
		newVal, err := perNullableFloat(e, res, func(f *float64) *float64 {
			nF := float64(1)
			if f == nil || math.IsInf(*f, 0) || math.IsNaN(*f) {
				nF = 0
			}
			return &nF
		})
		if err != nil {
			return newRes, err
		}
		newRes.Values = append(newRes.Values, newVal)
	}
	return newRes, nil
}

// perFloat passes the non-null value of a Scalar/Number or each value point of a Series to floatF.
// The return Value type will be the same type provided to function, (e.g. a Series input returns a series).
// If input values are null the function is not called and NaN is returned for each value.
func perFloat(e *State, val Value, floatF func(x float64) float64) (Value, error) {
	var newVal Value
	switch val.Type() {
	case parse.TypeNumberSet:
		n := NewNumber(e.RefID, val.GetLabels())
		f := val.(Number).GetFloat64Value()
		nF := math.NaN()
		if f != nil {
			nF = floatF(*f)
		}
		n.SetValue(&nF)
		newVal = n
	case parse.TypeScalar:
		f := val.(Scalar).GetFloat64Value()
		nF := math.NaN()
		if f != nil {
			nF = floatF(*f)
		}
		newVal = NewScalar(e.RefID, &nF)
	case parse.TypeSeriesSet:
		resSeries := val.(Series)
		newSeries := NewSeries(e.RefID, resSeries.GetLabels(), resSeries.Len())
		for i := 0; i < resSeries.Len(); i++ {
			t, f := resSeries.GetPoint(i)
			nF := math.NaN()
			if f != nil {
				nF = floatF(*f)
			}
			if err := newSeries.SetPoint(i, t, &nF); err != nil {
				return newSeries, err
			}
		}
		newVal = newSeries
	default:
		// TODO: Should we deal with TypeString, TypeVariantSet?
	}

	return newVal, nil
}

// perNullableFloat is like perFloat, but takes and returns float pointers instead of floats.
// This is for instead for functions that need specific null handling.
// The input float pointer should not be modified in the floatF func.
func perNullableFloat(e *State, val Value, floatF func(x *float64) *float64) (Value, error) {
	var newVal Value
	switch val.Type() {
	case parse.TypeNumberSet:
		n := NewNumber(e.RefID, val.GetLabels())
		f := val.(Number).GetFloat64Value()
		n.SetValue(floatF(f))
		newVal = n
	case parse.TypeScalar:
		f := val.(Scalar).GetFloat64Value()
		newVal = NewScalar(e.RefID, floatF(f))
	case parse.TypeSeriesSet:
		resSeries := val.(Series)
		newSeries := NewSeries(e.RefID, resSeries.GetLabels(), resSeries.Len())
		for i := 0; i < resSeries.Len(); i++ {
			t, f := resSeries.GetPoint(i)
			if err := newSeries.SetPoint(i, t, floatF(f)); err != nil {
				return newSeries, err
			}
		}
		newVal = newSeries
	default:
		// TODO: Should we deal with TypeString, TypeVariantSet?
	}

	return newVal, nil
}

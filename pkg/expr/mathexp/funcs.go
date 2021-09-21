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
	"inf": {
		Return: parse.TypeScalar,
		F:      inf,
	},
	"null": {
		Return: parse.TypeScalar,
		F:      null,
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

// null returns a null scalar value
func null(e *State) Results {
	return NewScalarResults(e.RefID, nil)
}

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

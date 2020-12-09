package mathexp

import (
	"fmt"
	"math"
	"reflect"
	"runtime"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
)

// Expr holds a parsed math command expression.
type Expr struct {
	*parse.Tree
}

// State embeds a parsed Expr with variables and their results
// so the expression can act on them.
type State struct {
	*Expr
	Vars Vars
	// Could hold more properties that change behavior around:
	//  - Unions (How many result A and many Result B in case A + B are joined)
	//  - NaN/Null behavior
}

// Vars holds the results of datasource queries or other expression commands.
type Vars map[string]Results

// New creates a new expression tree
func New(expr string, funcs ...map[string]parse.Func) (*Expr, error) {
	funcs = append(funcs, builtins)
	t, err := parse.Parse(expr, funcs...)
	if err != nil {
		return nil, err
	}
	e := &Expr{
		Tree: t,
	}
	return e, nil
}

// Execute applies a parse expression to the context and executes it
func (e *Expr) Execute(vars Vars) (r Results, err error) {
	s := &State{
		Expr: e,
		Vars: vars,
	}
	return e.executeState(s)
}

func (e *Expr) executeState(s *State) (r Results, err error) {
	defer errRecover(&err, s)
	r, err = s.walk(e.Tree.Root)
	return
}

// errRecover is the handler that turns panics into returns from the top
// level of Parse.
func errRecover(errp *error, s *State) {
	e := recover()
	if e != nil {
		switch err := e.(type) {
		case runtime.Error:
			panic(e)
		case error:
			*errp = err
		default:
			panic(e)
		}
	}
}

// walk is the top level function to walk a parsed expression
// with its associate variables
func (e *State) walk(node parse.Node) (res Results, err error) {
	switch node := node.(type) {
	case *parse.ScalarNode:
		res = NewScalarResults(&node.Float64)
	case *parse.VarNode:
		res = e.Vars[node.Name]
	case *parse.BinaryNode:
		res, err = e.walkBinary(node)
	case *parse.UnaryNode:
		res, err = e.walkUnary(node)
	case *parse.FuncNode:
		res, err = e.walkFunc(node)
	default:
		return res, fmt.Errorf("expr: can not walk node type: %s", node.Type())
	}
	return
}

func (e *State) walkUnary(node *parse.UnaryNode) (Results, error) {
	a, err := e.walk(node.Arg)
	if err != nil {
		return Results{}, err
	}
	newResults := Results{}
	for _, val := range a.Values {
		var newVal Value
		switch rt := val.(type) {
		case Scalar:
			newVal = NewScalar(nil)
			f := rt.GetFloat64Value()
			if f != nil {
				newF, err := unaryOp(node.OpStr, *f)
				if err != nil {
					return newResults, err
				}
				newVal = NewScalar(&newF)
			}
		case Number:
			newVal, err = unaryNumber(rt, node.OpStr)
		case Series:
			newVal, err = unarySeries(rt, node.OpStr)
		default:
			return newResults, fmt.Errorf("can not perform a unary operation on type %v", rt.Type())
		}
		if err != nil {
			return newResults, err
		}
		newResults.Values = append(newResults.Values, newVal)
	}
	return newResults, nil
}

func unarySeries(s Series, op string) (Series, error) {
	newSeries := NewSeries(s.GetName(), s.GetLabels(), s.TimeIdx, s.TimeIsNullable, s.ValueIdx, s.ValueIsNullabe, s.Len())
	for i := 0; i < s.Len(); i++ {
		t, f := s.GetPoint(i)
		if f == nil {
			if err := newSeries.SetPoint(i, t, nil); err != nil {
				return newSeries, err
			}
			continue
		}
		newF, err := unaryOp(op, *f)
		if err != nil {
			return newSeries, err
		}
		if err := newSeries.SetPoint(i, t, &newF); err != nil {
			return newSeries, err
		}
	}
	return newSeries, nil
}

func unaryNumber(n Number, op string) (Number, error) {
	newNumber := NewNumber(n.GetName(), n.GetLabels())

	f := n.GetFloat64Value()
	if f != nil {
		newF, err := unaryOp(op, *f)
		if err != nil {
			return newNumber, err
		}
		newNumber.SetValue(&newF)
	}
	return newNumber, nil
}

// unaryOp performs a unary operation on a float.
func unaryOp(op string, a float64) (r float64, err error) {
	if math.IsNaN(a) {
		return math.NaN(), nil
	}
	switch op {
	case "!":
		if a == 0 {
			r = 1
		} else {
			r = 0
		}
	case "-":
		r = -a
	default:
		return r, fmt.Errorf("expr: unknown unary operator %s", op)
	}
	return
}

// Union holds to Values from Two sets where their labels are compatible (TODO: define compatible).
// This is a intermediate container for Binary operations such (e.g. A + B).
type Union struct {
	Labels data.Labels
	A, B   Value
}

// union creates Union objects based on the Labels attached to each Series or Number
// within a collection of Series or Numbers. The Unions are used with binary
// operations. The labels of the Union will the taken from result with a greater
// number of tags.
func union(aResults, bResults Results) []*Union {
	unions := []*Union{}
	if len(aResults.Values) == 0 || len(bResults.Values) == 0 {
		return unions
	}
	for _, a := range aResults.Values {
		for _, b := range bResults.Values {
			var labels data.Labels
			aLabels := a.GetLabels()
			bLabels := b.GetLabels()
			switch {
			case aLabels.Equals(bLabels) || len(aLabels) == 0 || len(bLabels) == 0:
				l := aLabels
				if len(aLabels) == 0 {
					l = bLabels
				}
				labels = l
			case len(aLabels) == len(bLabels):
				continue // invalid union, drop for now
			case aLabels.Contains(bLabels):
				labels = aLabels
			case bLabels.Contains(aLabels):
				labels = bLabels
			default:
				continue
			}
			u := &Union{
				Labels: labels,
				A:      a,
				B:      b,
			}
			unions = append(unions, u)
		}
	}
	if len(unions) == 0 && len(aResults.Values) == 1 && len(bResults.Values) == 1 {
		// In the case of only 1 thing on each side of the operator, we combine them
		// and strip the tags.
		// This isn't ideal for understanding behavior, but will make more stuff work when
		// combining different datasources without munging.
		// This choice is highly questionable in the long term.
		unions = append(unions, &Union{
			A: aResults.Values[0],
			B: bResults.Values[0],
		})
	}
	return unions
}

func (e *State) walkBinary(node *parse.BinaryNode) (Results, error) {
	res := Results{Values{}}
	ar, err := e.walk(node.Args[0])
	if err != nil {
		return res, err
	}
	br, err := e.walk(node.Args[1])
	if err != nil {
		return res, err
	}
	unions := union(ar, br)
	for _, uni := range unions {
		name := uni.Labels.String()
		var value Value
		switch at := uni.A.(type) {
		case Scalar:
			aFloat := at.GetFloat64Value()
			switch bt := uni.B.(type) {
			// Scalar op Scalar
			case Scalar:
				bFloat := bt.GetFloat64Value()
				if aFloat == nil || bFloat == nil {
					value = NewScalar(nil)
					break
				}
				f := math.NaN()
				if aFloat != nil && bFloat != nil {
					f, err = binaryOp(node.OpStr, *aFloat, *bFloat)
					if err != nil {
						return res, err
					}
				}
				value = NewScalar(&f)
			// Scalar op Scalar
			case Number:
				value, err = biScalarNumber(name, uni.Labels, node.OpStr, bt, aFloat, false)
			// Scalar op Series
			case Series:
				value, err = biSeriesNumber(name, uni.Labels, node.OpStr, bt, aFloat, false)
			default:
				return res, fmt.Errorf("not implemented: binary %v on %T and %T", node.OpStr, uni.A, uni.B)
			}
		case Series:
			switch bt := uni.B.(type) {
			// Series Op Scalar
			case Scalar:
				bFloat := bt.GetFloat64Value()
				value, err = biSeriesNumber(name, uni.Labels, node.OpStr, at, bFloat, true)
			// case Series Op Number
			case Number:
				bFloat := bt.GetFloat64Value()
				value, err = biSeriesNumber(name, uni.Labels, node.OpStr, at, bFloat, true)
			// case Series op Series
			case Series:
				value, err = biSeriesSeries(name, uni.Labels, node.OpStr, at, bt)
			default:
				return res, fmt.Errorf("not implemented: binary %v on %T and %T", node.OpStr, uni.A, uni.B)
			}
		case Number:
			aFloat := at.GetFloat64Value()
			switch bt := uni.B.(type) {
			case Scalar:
				bFloat := bt.GetFloat64Value()
				value, err = biScalarNumber(name, uni.Labels, node.OpStr, at, bFloat, true)
			case Number:
				bFloat := bt.GetFloat64Value()
				value, err = biScalarNumber(name, uni.Labels, node.OpStr, at, bFloat, true)
			case Series:
				value, err = biSeriesNumber(name, uni.Labels, node.OpStr, bt, aFloat, false)
			default:
				return res, fmt.Errorf("not implemented: binary %v on %T and %T", node.OpStr, uni.A, uni.B)
			}
		default:
			return res, fmt.Errorf("not implemented: binary %v on %T and %T", node.OpStr, uni.A, uni.B)
		}
		if err != nil {
			return res, err
		}
		res.Values = append(res.Values, value)
	}
	return res, nil
}

// binaryOp performs a binary operations (e.g. A+B or A>B) on two
// float values
// nolint:gocyclo
func binaryOp(op string, a, b float64) (r float64, err error) {
	// Test short circuit before NaN.
	switch op {
	case "||":
		if a != 0 {
			return 1, nil
		}
	case "&&":
		if a == 0 {
			return 0, nil
		}
	}
	if math.IsNaN(a) || math.IsNaN(b) {
		return math.NaN(), nil
	}
	switch op {
	case "+":
		r = a + b
	case "*":
		r = a * b
	case "-":
		r = a - b
	case "/":
		r = a / b
	case "**":
		r = math.Pow(a, b)
	case "%":
		r = math.Mod(a, b)
	case "==":
		if a == b {
			r = 1
		} else {
			r = 0
		}
	case ">":
		if a > b {
			r = 1
		} else {
			r = 0
		}
	case "!=":
		if a != b {
			r = 1
		} else {
			r = 0
		}
	case "<":
		if a < b {
			r = 1
		} else {
			r = 0
		}
	case ">=":
		if a >= b {
			r = 1
		} else {
			r = 0
		}
	case "<=":
		if a <= b {
			r = 1
		} else {
			r = 0
		}
	case "||":
		if a != 0 || b != 0 {
			r = 1
		} else {
			r = 0
		}
	case "&&":
		if a != 0 && b != 0 {
			r = 1
		} else {
			r = 0
		}
	default:
		return r, fmt.Errorf("expr: unknown operator %s", op)
	}
	return r, nil
}

func biScalarNumber(name string, labels data.Labels, op string, number Number, scalarVal *float64, numberFirst bool) (Number, error) {
	newNumber := NewNumber(name, labels)
	f := number.GetFloat64Value()
	if f == nil || scalarVal == nil {
		newNumber.SetValue(nil)
		return newNumber, nil
	}
	nF := math.NaN()
	var err error
	if numberFirst {
		nF, err = binaryOp(op, *f, *scalarVal)
	} else {
		nF, err = binaryOp(op, *scalarVal, *f)
	}
	if err != nil {
		return newNumber, err
	}
	newNumber.SetValue(&nF)
	return newNumber, nil
}

func biSeriesNumber(name string, labels data.Labels, op string, s Series, scalarVal *float64, seriesFirst bool) (Series, error) {
	newSeries := NewSeries(name, labels, s.TimeIdx, s.TimeIsNullable, s.ValueIdx, s.ValueIsNullabe, s.Len())
	var err error
	for i := 0; i < s.Len(); i++ {
		nF := math.NaN()
		t, f := s.GetPoint(i)
		if f == nil || scalarVal == nil {
			if err := newSeries.SetPoint(i, t, nil); err != nil {
				return newSeries, err
			}
			continue
		}
		if seriesFirst {
			nF, err = binaryOp(op, *f, *scalarVal)
		} else {
			nF, err = binaryOp(op, *scalarVal, *f)
		}
		if err != nil {
			return newSeries, err
		}
		if err := newSeries.SetPoint(i, t, &nF); err != nil {
			return newSeries, err
		}
	}
	return newSeries, nil
}

// ... if would you like some series with your series and then get some series, or is that enough series?
// biSeriesSeries performs a the binary operation for each value in the two series where the times
// are equal. If there are datapoints in A or B that do not share a time, they will be dropped.
func biSeriesSeries(name string, labels data.Labels, op string, aSeries, bSeries Series) (Series, error) {
	bPoints := make(map[time.Time]*float64)
	for i := 0; i < bSeries.Len(); i++ {
		t, f := bSeries.GetPoint(i)
		if t != nil {
			bPoints[*t] = f
		}
	}

	newSeries := NewSeries(name, labels, aSeries.TimeIdx, aSeries.TimeIsNullable || bSeries.TimeIsNullable, aSeries.ValueIdx, aSeries.ValueIsNullabe || bSeries.ValueIsNullabe, 0)
	for aIdx := 0; aIdx < aSeries.Len(); aIdx++ {
		aTime, aF := aSeries.GetPoint(aIdx)
		bF, ok := bPoints[*aTime]
		if !ok {
			continue
		}
		if aF == nil || bF == nil {
			if err := newSeries.AppendPoint(aIdx, aTime, nil); err != nil {
				return newSeries, err
			}
			continue
		}
		nF, err := binaryOp(op, *aF, *bF)
		if err != nil {
			return newSeries, err
		}
		if err := newSeries.AppendPoint(aIdx, aTime, &nF); err != nil {
			return newSeries, err
		}
	}
	return newSeries, nil
}

func (e *State) walkFunc(node *parse.FuncNode) (Results, error) {
	var res Results
	var err error
	var in []reflect.Value
	for _, a := range node.Args {
		var v interface{}
		switch t := a.(type) {
		case *parse.StringNode:
			v = t.Text
		case *parse.VarNode:
			v = e.Vars[t.Name]
		case *parse.ScalarNode:
			v = NewScalarResults(&t.Float64)
		case *parse.FuncNode:
			v, err = e.walkFunc(t)
		case *parse.UnaryNode:
			v, err = e.walkUnary(t)
		case *parse.BinaryNode:
			v, err = e.walkBinary(t)
		default:
			return res, fmt.Errorf("expr: unknown func arg type: %T", t)
		}
		if err != nil {
			return res, err
		}
		in = append(in, reflect.ValueOf(v))
	}

	f := reflect.ValueOf(node.F.F)

	fr := f.Call(append([]reflect.Value{reflect.ValueOf(e)}, in...))

	res = fr[0].Interface().(Results)
	if len(fr) > 1 && !fr[1].IsNil() {
		err := fr[1].Interface().(error)
		if err != nil {
			return res, err
		}
	}
	return res, nil
}

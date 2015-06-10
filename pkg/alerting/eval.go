package alerting

import (
	"bosun.org/cmd/bosun/cache"
	"bosun.org/cmd/bosun/expr"
	"bosun.org/graphite"
	"fmt"
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

type CheckDef struct {
	CritExpr string
	WarnExpr string
}

func (c CheckDef) String() string {
	return fmt.Sprintf("<CheckDef> Crit: ''%s' -- Warn: '%s'", c.CritExpr, c.WarnExpr)
}

type Check struct {
	// do we need these members here?
	//Id           int64
	//OrgId        int64
	//DataSourceId int64
	Definition CheckDef
}

type CheckEvaluator interface {
	Eval() (*m.CheckEvalResult, error)
}

type GraphiteCheckEvaluator struct {
	Context  graphite.Context
	Check    CheckDef
	critExpr *expr.Expr
	warnExpr *expr.Expr
}

func NewGraphiteCheckEvaluator(c graphite.Context, check CheckDef) (*GraphiteCheckEvaluator, error) {
	var warnExpr *expr.Expr
	var critExpr *expr.Expr
	var err error
	if check.WarnExpr != "" {
		warnExpr, err = expr.New(check.WarnExpr, expr.Graphite)
		if err != nil {
			return nil, err
		}
	}
	if check.CritExpr != "" {
		critExpr, err = expr.New(check.CritExpr, expr.Graphite)
		if err != nil {
			return nil, err
		}
	}
	return &GraphiteCheckEvaluator{
		Context:  c,
		Check:    check,
		warnExpr: warnExpr,
		critExpr: critExpr,
	}, nil
}

func (ce *GraphiteCheckEvaluator) Eval(ts time.Time) (m.CheckEvalResult, error) {
	// create cache
	// this is so that when bosun queries the same graphite query multiple times
	// like in (median(graphite("foo", "2m", "",""))> 10 || avg(graphite("foo", "2m", "","")) > 20)
	// it reuses the same resultsets internally.
	// cache is unbounded so that we are guaranteed consistent results
	cacheObj := cache.New(0)
	eval := func(e *expr.Expr, code m.CheckEvalResult) (m.CheckEvalResult, error) {
		results, _, err := e.Execute(nil, ce.Context, nil, cacheObj, nil, ts, 0, true, nil, nil, nil)
		if err != nil {
			return m.EvalResultUnknown, err
		}
		for _, res := range results.Results {
			switch i := res.Value.Value().(type) {
			case expr.Number:
				if int(i) > 0 {
					return code, nil
				}
			case expr.Scalar:
				if int(i) > 0 {
					return code, nil
				}
			default:
				panic(fmt.Sprintf("expr.Execute returned unknown result with type %T and value %v", res, res))
			}
		}
		return m.EvalResultOK, nil
	}

	if ce.critExpr != nil {
		ret, err := eval(ce.critExpr, m.EvalResultCrit)
		if err != nil {
			return ret, err
		}
		if ret != m.EvalResultOK {
			return ret, err
		}
	}

	if ce.warnExpr != nil {
		return eval(ce.warnExpr, m.EvalResultWarn)
	}

	return m.EvalResultOK, nil
}

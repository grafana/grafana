package alerting

import (
	"fmt"
	"strings"
	"time"

	"bosun.org/cmd/bosun/cache"
	"bosun.org/cmd/bosun/expr"
	"bosun.org/graphite"
	m "github.com/grafana/grafana/pkg/models"
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

//TODO instrument error scenarios
// Eval evaluates the crit/warn expression and returns the result, and any non-fatal error (implying the query should be retried later,
// when a temporary infra problem restores) as well as fatal errors.
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
			// graphite errors are probably transient and non-fatal.
			if strings.Contains(err.Error(), "graphite") {
				return m.EvalResultUnknown, fmt.Errorf("non-fatal: %q", err)
			}
			// others are probably fatal, i.e. not transient. (expression mixes incompatible types, incorrect function call,...)
			return m.EvalResultUnknown, fmt.Errorf("fatal: %q", err)
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
				return m.EvalResultUnknown, fmt.Errorf("fatal: expr.Execute for %q returned unknown result with type %T and value %v", e, res, res)
			}
		}
		return m.EvalResultOK, nil
	}

	if ce.critExpr != nil {
		ret, err := eval(ce.critExpr, m.EvalResultCrit)
		if err != nil || ret != m.EvalResultOK {
			return ret, err
		}
	}

	if ce.warnExpr != nil {
		return eval(ce.warnExpr, m.EvalResultWarn)
	}

	return m.EvalResultOK, nil
}

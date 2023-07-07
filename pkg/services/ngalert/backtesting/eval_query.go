package backtesting

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

// QueryEvaluator is evaluator of regular alert rule queries
type queryEvaluator struct {
	eval eval.ConditionEvaluator
}

func (d *queryEvaluator) Eval(ctx context.Context, from time.Time, interval time.Duration, evaluations int, callback callbackFunc) error {
	for idx, now := 0, from; idx < evaluations; idx, now = idx+1, now.Add(interval) {
		results, err := d.eval.Evaluate(ctx, now)
		if err != nil {
			return err
		}
		err = callback(idx, now, results)
		if err != nil {
			return err
		}
	}
	return nil
}

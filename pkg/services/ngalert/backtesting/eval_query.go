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

func (d *queryEvaluator) Eval(ctx context.Context, from, to time.Time, interval time.Duration, callback callbackFunc) error {
	for now := from; now.Before(to); now = now.Add(interval) {
		results, err := d.eval.Evaluate(ctx, now)
		if err != nil {
			return err
		}
		err = callback(now, results)
		if err != nil {
			return err
		}
	}
	return nil
}

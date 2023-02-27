package backtesting

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

// DataEvaluator is evaluator that evaluates data
type dataEvaluator struct {
	refID              string
	data               []mathexp.Series
	downsampleFunction string
	upsampleFunction   string
}

func newDataEvaluator(refID string, frame *data.Frame) (*dataEvaluator, error) {
	series, err := expr.WideToMany(frame)
	if err != nil {
		return nil, err
	}
	for _, s := range series {
		s.SortByTime(false)
	}

	return &dataEvaluator{
		refID:              refID,
		data:               series,
		downsampleFunction: "last",
		upsampleFunction:   "pad",
	}, nil
}

func (d *dataEvaluator) Eval(_ context.Context, from, to time.Time, interval time.Duration, callback callbackFunc) error {
	var resampled = make([]mathexp.Series, 0, len(d.data))

	iterations := 0
	for _, s := range d.data {
		// making sure the input data frame is aligned with the interval
		r, err := s.Resample(d.refID, interval, d.downsampleFunction, d.upsampleFunction, from, to.Add(-interval)) // we want to query [from,to)
		if err != nil {
			return err
		}
		resampled = append(resampled, r)
		iterations = r.Len()
	}

	for i := 0; i < iterations; i++ {
		result := make([]eval.Result, 0, len(resampled))
		var now time.Time
		for _, series := range resampled {
			snow := series.GetTime(i)
			if !now.IsZero() && now != snow { // this should not happen because all series' belong to a single data frame
				return errors.New("failed to resample input data. timestamps are not aligned")
			}
			now = snow
			value := series.GetValue(i)
			var state = eval.Normal
			if value == nil {
				continue
			} else if *value != 0 {
				state = eval.Alerting
			}
			result = append(result, eval.Result{
				Instance: series.GetLabels(),
				State:    state,
				Results:  nil,
				Values: map[string]eval.NumberValueCapture{
					d.refID: {
						Var:    d.refID,
						Labels: series.GetLabels(),
						Value:  value,
					},
				},
				EvaluatedAt: now,
			})
		}
		if len(result) == 0 {
			result = append(result, eval.Result{
				State:       eval.NoData,
				EvaluatedAt: now,
			})
		}
		err := callback(now, result)
		if err != nil {
			return err
		}
	}
	return nil
}

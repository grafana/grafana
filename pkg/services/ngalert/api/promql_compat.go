package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/cortexproject/cortex/pkg/util"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/promql/parser"
)

type instantQueryResponse struct {
	Status    string    `json:"status"`
	Data      queryData `json:"data,omitempty"`
	ErrorType string    `json:"errorType,omitempty"`
	Error     string    `json:"error,omitempty"`
}

type queryData struct {
	ResultType parser.ValueType `json:"resultType"`
	Result     json.RawMessage  `json:"result"`
	vector     vector           `json:"-"`
	scalar     scalar           `json:"-"`
}

type scalar promql.Scalar

func (s *scalar) UnmarshalJSON(b []byte) error {
	var xs []interface{}
	if err := json.Unmarshal(b, &xs); err != nil {
		return err
	}
	// scalars are encoded like `[ts/1000, "value"]`
	if len(xs) != 2 {
		return fmt.Errorf("unexpected number of scalar encoded values: %d", len(xs))
	}
	ts, ok := xs[0].(float64)
	if !ok {
		return fmt.Errorf("first value in scalar uncoercible to timestamp: %v", xs[0])
	}
	s.T = int64(ts) * 1000
	v, ok := xs[1].(string)
	if !ok {
		return fmt.Errorf("second value in scalar not string encoded: %v", xs[1])
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return err
	}
	s.V = f
	return nil
}

func (d *queryData) UnmarshalJSON(b []byte) error {
	type plain queryData
	if err := json.Unmarshal(b, (*plain)(d)); err != nil {
		return err
	}

	switch d.ResultType {
	case parser.ValueTypeScalar:
		return json.Unmarshal(d.Result, &d.scalar)
	case parser.ValueTypeVector:
		return json.Unmarshal(d.Result, &d.vector)
	default:
		return fmt.Errorf("unexpected response type: %s", d.ResultType)
	}
	return nil
}

type sample struct {
	Metric labels.Labels `json:"metric"`
	Value  scalar        `json:"value"`
}
type vector []sample

func instantQueryResults(resp instantQueryResponse) (eval.Results, error) {
	if resp.Error != "" || resp.Status != "success" {
		return nil, errors.New(resp.Error)
	}

	switch resp.Data.ResultType {
	case parser.ValueTypeScalar:
		return eval.Results{{
			Instance:         map[string]string{},
			State:            eval.Alerting,
			EvaluatedAt:      util.TimeFromMillis(resp.Data.scalar.T),
			EvaluationString: fmt.Sprint(resp.Data.scalar.V),
		}}
	case parser.ValueTypeVector:
		results := make(eval.Results, 0, len(resp.Data.vector))
		for _, s := range resp.Data.vector {
			results = append(results, eval.Result{
				Instance:         s.Metric.Map(),
				State:            eval.Alerting,
				EvaluatedAt:      util.TimeFromMillis(s.Value.T),
				EvaluationString: fmt.Sprint(s.Value.V),
			})
		}
	default:
		return nil, fmt.Errorf("unexpected response type: %s", d.ResultType)
	}
}

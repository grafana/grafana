package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/promql/parser"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/util"
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
			Instance:    map[string]string{},
			State:       eval.Alerting,
			EvaluatedAt: TimeFromMillis(resp.Data.scalar.T),
			EvaluationString: extractEvalStringFromProm(sample{
				Value: resp.Data.scalar,
			}),
		}}, nil
	case parser.ValueTypeVector:
		results := make(eval.Results, 0, len(resp.Data.vector))
		for _, s := range resp.Data.vector {
			results = append(results, eval.Result{
				Instance:         s.Metric.Map(),
				State:            eval.Alerting,
				EvaluatedAt:      TimeFromMillis(s.Value.T),
				EvaluationString: extractEvalStringFromProm(s),
			})
		}
		return results, nil
	default:
		return nil, fmt.Errorf("unexpected response type: %s", resp.Data.ResultType)
	}
}

func instantQueryResultsExtractor(r *response.NormalResponse) (interface{}, error) {
	contentType := r.Header().Get("Content-Type")
	if !strings.Contains(contentType, "json") {
		return nil, fmt.Errorf("unexpected content type from upstream. expected JSON, got %v", contentType)
	}
	var resp instantQueryResponse
	err := json.Unmarshal(r.Body(), &resp)
	if err != nil {
		return nil, err
	}

	res, err := instantQueryResults(resp)
	if err != nil {
		return nil, err
	}
	frame := res.AsDataFrame()

	return util.DynMap{
		"instances": []*data.Frame{&frame},
	}, nil
}

// extractEvalStringFromProm is intended to mimic the functionality used in ngalert/eval
func extractEvalStringFromProm(s sample) string {
	var sb strings.Builder
	sb.WriteString("[ ")
	var ls string
	if len(s.Metric) > 0 {
		ls = s.Metric.String()
	}
	sb.WriteString(fmt.Sprintf("labels={%s} ", ls))
	sb.WriteString(fmt.Sprintf("value=%v ", fmt.Sprintf("%v", s.Value.V)))
	sb.WriteString("]")
	return sb.String()
}

// TimeFromMillis Copied from https://github.com/grafana/mimir/blob/main/pkg/util/time.go as it doesn't seem worth it to import Mimir.
// TimeFromMillis is a helper to turn milliseconds -> time.Time
func TimeFromMillis(ms int64) time.Time {
	return time.Unix(ms/1000, (ms%1000)*int64(time.Millisecond)).UTC()
}

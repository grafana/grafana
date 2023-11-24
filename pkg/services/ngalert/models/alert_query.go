package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/expr"
)

const defaultMaxDataPoints int64 = 43200 // 12 hours at 1sec interval
const defaultIntervalMS int64 = 1000

const (
	maxDataPointsKey = "maxDataPoints"
	intervalMSKey    = "intervalMs"
	exprKey          = "expr"
	queryTypeKey     = "queryType"
)

var ErrNoQuery = errors.New("no `expr` property in the query model")

// Duration is a type used for marshalling durations.
type Duration time.Duration

func (d Duration) String() string {
	return time.Duration(d).String()
}

func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).Seconds())
}

func (d *Duration) UnmarshalJSON(b []byte) error {
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = Duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}

func (d Duration) MarshalYAML() (any, error) {
	return time.Duration(d).Seconds(), nil
}

func (d *Duration) UnmarshalYAML(unmarshal func(any) error) error {
	var v any
	if err := unmarshal(&v); err != nil {
		return err
	}
	switch value := v.(type) {
	case int:
		*d = Duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}

// RelativeTimeRange is the per query start and end time
// for requests.
type RelativeTimeRange struct {
	From Duration `json:"from" yaml:"from"`
	To   Duration `json:"to" yaml:"to"`
}

// isValid checks that From duration is greater than To duration.
func (rtr *RelativeTimeRange) isValid() bool {
	return rtr.From > rtr.To
}

func (rtr *RelativeTimeRange) ToTimeRange() expr.TimeRange {
	return expr.RelativeTimeRange{
		From: -time.Duration(rtr.From),
		To:   -time.Duration(rtr.To),
	}
}

// AlertQuery represents a single query associated with an alert definition.
type AlertQuery struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId"`

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType"`

	// RelativeTimeRange is the relative Start and End of the query as sent by the frontend.
	RelativeTimeRange RelativeTimeRange `json:"relativeTimeRange"`

	// Grafana data source unique identifier; it should be '__expr__' for a Server Side Expression operation.
	DatasourceUID string `json:"datasourceUid"`

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	// This should not be used directly when maxDataPoints or intervalMs is needed as they might need to be calculated.
	// Instead, use CalculateModel() to get the CalculatedModel.
	Model json.RawMessage `json:"model"`
}

func (aq *AlertQuery) String() string {
	return fmt.Sprintf("refID: %s, queryType: %s, datasourceUID: %s", aq.RefID, aq.QueryType, aq.DatasourceUID)
}

// IsExpression returns true if the alert query is an expression.
func (aq *AlertQuery) IsExpression() bool {
	return expr.NodeTypeFromDatasourceUID(aq.DatasourceUID) == expr.TypeCMDNode
}

func (aq *AlertQuery) CalculateModel() (CalculatedModel, error) {
	return fromRawModel(aq.Model)
}

// PreSave sets query's properties.
// It should be called before being saved.
func (aq *AlertQuery) PreSave() error {
	cm, err := aq.CalculateModel()
	if err != nil {
		return err
	}

	if queryType, err := cm.GetQueryType(); err != nil {
		return fmt.Errorf("failed to set query type to query model: %w", err)
	} else if queryType != "" {
		aq.QueryType = queryType
	}

	model, err := json.Marshal(cm)
	if err != nil {
		return fmt.Errorf("failed to marshal query model: %w", err)
	}
	aq.Model = model

	return nil
}

func (aq *AlertQuery) Validate() error {
	if ok := aq.IsExpression() || aq.RelativeTimeRange.isValid(); !ok {
		return fmt.Errorf("invalid relative time range: %+v", aq.RelativeTimeRange)
	}
	return nil
}

type CalculatedModel map[string]any

func fromRawModel(model json.RawMessage) (CalculatedModel, error) {
	cm := make(CalculatedModel)
	err := json.Unmarshal(model, &cm)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal query model: %w", err)
	}

	// GEL requires intervalMs and maxDataPoints inside the query JSON
	maxDataPoints, err := cm.GetMaxDataPoints()
	if err != nil || maxDataPoints <= 0 {
		cm[maxDataPointsKey] = defaultMaxDataPoints
	}

	interval, err := cm.GetIntervalDuration()
	if err != nil || interval <= 0 {
		cm[intervalMSKey] = defaultIntervalMS
	}

	return cm, nil
}

func (cm CalculatedModel) GetQueryType() (string, error) {
	i, ok := cm[queryTypeKey]
	if !ok {
		return "", nil
	}

	queryType, ok := i.(string)
	if !ok {
		return "", fmt.Errorf("failed to get queryType from query model: %v", cm[queryTypeKey])
	}
	return queryType, nil
}

// GetQuery returns the query defined by `expr` within the model.
// Returns an ErrNoQuery if it is unable to find the query.
// Returns an error if it is not able to cast the query to a string.
func (cm CalculatedModel) GetQuery() (string, error) {
	query, ok := cm[exprKey]
	if !ok {
		return "", ErrNoQuery
	}

	q, ok := query.(string)
	if !ok {
		return "", fmt.Errorf("failed to cast query to string: %v", cm[exprKey])
	}
	return q, nil
}

func (cm CalculatedModel) GetMaxDataPoints() (int64, error) {
	switch maxDataPoints := cm[maxDataPointsKey].(type) {
	case int64:
		return maxDataPoints, nil
	case float64: // Default type for JSON numbers.
		return int64(maxDataPoints), nil
	default:
		return 0, fmt.Errorf("failed to cast maxDataPoints: %v", cm[maxDataPointsKey])
	}
}

func (cm CalculatedModel) GetIntervalDuration() (time.Duration, error) {
	switch intervalMs := cm[intervalMSKey].(type) {
	case int64:
		return time.Duration(intervalMs) * time.Millisecond, nil
	case float64: // Default type for JSON numbers.
		return time.Duration(intervalMs) * time.Millisecond, nil
	default:
		return 0, fmt.Errorf("failed to cast intervalMs: %v", cm[intervalMSKey])
	}
}

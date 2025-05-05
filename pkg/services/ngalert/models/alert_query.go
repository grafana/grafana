package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr"
)

const defaultMaxDataPoints float64 = 43200 // 12 hours at 1sec interval
const defaultIntervalMS float64 = 1000

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
	Model json.RawMessage `json:"model"`

	// DatrasourceType is the type of the data source.
	DatasourceType string `json:"-"`

	// IsMTQuery ...
	IsMTQuery bool `json:"-"`

	modelProps map[string]any
}

func (aq *AlertQuery) String() string {
	return fmt.Sprintf("refID: %s, queryType: %s, datasourceUID: %s", aq.RefID, aq.QueryType, aq.DatasourceUID)
}

func (aq *AlertQuery) setModelProps() error {
	aq.modelProps = make(map[string]any)
	err := json.Unmarshal(aq.Model, &aq.modelProps)
	if err != nil {
		return fmt.Errorf("failed to unmarshal query model: %w", err)
	}

	return nil
}

// IsExpression returns true if the alert query is an expression.
func (aq *AlertQuery) IsExpression() (bool, error) {
	return expr.NodeTypeFromDatasourceUID(aq.DatasourceUID) == expr.TypeCMDNode, nil
}

// IsHysteresisExpression returns true if the model describes a hysteresis command expression. Returns error if the Model is not a valid JSON
func (aq *AlertQuery) IsHysteresisExpression() (bool, error) {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return false, err
		}
	}
	return expr.IsHysteresisExpression(aq.modelProps), nil
}

// PatchHysteresisExpression updates the AlertQuery to include loaded metrics into hysteresis
func (aq *AlertQuery) PatchHysteresisExpression(loadedMetrics map[data.Fingerprint]struct{}) error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}
	return expr.SetLoadedDimensionsToHysteresisCommand(aq.modelProps, loadedMetrics)
}

// setMaxDatapoints sets the model maxDataPoints if it's missing or invalid
func (aq *AlertQuery) setMaxDatapoints() error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}
	i, ok := aq.modelProps["maxDataPoints"] // GEL requires maxDataPoints inside the query JSON
	if !ok {
		aq.modelProps["maxDataPoints"] = defaultMaxDataPoints
	}
	maxDataPoints, ok := i.(float64)
	if !ok || maxDataPoints == 0 {
		aq.modelProps["maxDataPoints"] = defaultMaxDataPoints
	}
	return nil
}

func (aq *AlertQuery) GetMaxDatapoints() (int64, error) {
	err := aq.setMaxDatapoints()
	if err != nil {
		return 0, err
	}

	maxDataPoints, ok := aq.modelProps["maxDataPoints"].(float64)
	if !ok {
		return 0, fmt.Errorf("failed to cast maxDataPoints to float64: %v", aq.modelProps["maxDataPoints"])
	}
	return int64(maxDataPoints), nil
}

// setIntervalMS sets the model IntervalMs if it's missing or invalid
func (aq *AlertQuery) setIntervalMS() error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}
	i, ok := aq.modelProps["intervalMs"] // GEL requires intervalMs inside the query JSON
	if !ok {
		aq.modelProps["intervalMs"] = defaultIntervalMS
	}
	intervalMs, ok := i.(float64)
	if !ok || intervalMs == 0 {
		aq.modelProps["intervalMs"] = defaultIntervalMS
	}
	return nil
}

func (aq *AlertQuery) getIntervalMS() (int64, error) {
	err := aq.setIntervalMS()
	if err != nil {
		return 0, err
	}

	intervalMs, ok := aq.modelProps["intervalMs"].(float64)
	if !ok {
		return 0, fmt.Errorf("failed to cast intervalMs to float64: %v", aq.modelProps["intervalMs"])
	}
	return int64(intervalMs), nil
}

func (aq *AlertQuery) GetIntervalDuration() (time.Duration, error) {
	err := aq.setIntervalMS()
	if err != nil {
		return 0, err
	}

	intervalMs, ok := aq.modelProps["intervalMs"].(float64)
	if !ok {
		return 0, fmt.Errorf("failed to cast intervalMs to float64: %v", aq.modelProps["intervalMs"])
	}
	return time.Duration(intervalMs) * time.Millisecond, nil
}

// GetDatasource returns the query datasource identifier.
func (aq *AlertQuery) GetDatasource() (string, error) {
	return aq.DatasourceUID, nil
}

// GetQuery returns the query defined by `expr` within the model.
// Returns an ErrNoQuery if it is unable to find the query.
// Returns an error if it is not able to cast the query to a string.
func (aq *AlertQuery) GetQuery() (string, error) {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return "", err
		}
	}
	query, ok := aq.modelProps["expr"]
	if !ok {
		return "", ErrNoQuery
	}

	q, ok := query.(string)
	if !ok {
		return "", fmt.Errorf("failed to cast query to string: %v", aq.modelProps["expr"])
	}
	return q, nil
}

func (aq *AlertQuery) GetModel() ([]byte, error) {
	err := aq.setMaxDatapoints()
	if err != nil {
		return nil, err
	}

	err = aq.setIntervalMS()
	if err != nil {
		return nil, err
	}

	model, err := json.Marshal(aq.modelProps)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal query model: %w", err)
	}
	return model, nil
}

func (aq *AlertQuery) setQueryType() error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}
	i, ok := aq.modelProps["queryType"]
	if !ok {
		return nil
	}

	queryType, ok := i.(string)
	if !ok {
		return fmt.Errorf("failed to get queryType from query model: %v", i)
	}

	aq.QueryType = queryType
	return nil
}

// PreSave sets query's properties.
// It should be called before being saved.
func (aq *AlertQuery) PreSave() error {
	if err := aq.setQueryType(); err != nil {
		return fmt.Errorf("failed to set query type to query model: %w", err)
	}

	// Initialize defaults, which also overrides the model
	if err := aq.InitDefaults(); err != nil {
		return err
	}

	isExpression, err := aq.IsExpression()
	if err != nil {
		return err
	}

	if ok := isExpression || aq.RelativeTimeRange.isValid(); !ok {
		return ErrInvalidRelativeTimeRange(aq.RefID, aq.RelativeTimeRange)
	}
	return nil
}

// InitDefaults ensures all default parameters are set in the query model.
// This helps maintain consistent query models for comparisons.
func (aq *AlertQuery) InitDefaults() error {
	model, err := aq.GetModel()
	if err != nil {
		return err
	}
	aq.Model = model
	return nil
}

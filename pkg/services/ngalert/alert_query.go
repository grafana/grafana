package ngalert

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const defaultMaxDataPoints float64 = 100
const defaultIntervalMs float64 = 1000
const defaultExprDatasourceID = -100

type duration time.Duration

func (d duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).String())
}

func (d *duration) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = duration(time.Duration(value))
		return nil
	case string:
		tmp, err := time.ParseDuration(value)
		if err != nil {
			return err
		}
		*d = duration(tmp)
		return nil
	default:
		return errors.New("invalid duration")
	}
}

// RelativeTimeRange is the per query start and end time
// for requests.
type RelativeTimeRange struct {
	From duration
	To   duration
}

// IsValid check that From duration is greater than To duration.
func (rtr *RelativeTimeRange) IsValid() bool {
	return rtr.From > rtr.To
}

func (rtr *RelativeTimeRange) toTimeRange(now time.Time) backend.TimeRange {
	return backend.TimeRange{
		From: now.Add(-time.Duration(rtr.From)),
		To:   now.Add(-time.Duration(rtr.To)),
	}
}

// AlertQuery represents a single query associated with an alert definition.
type AlertQuery struct {
	/*
		// AlertDefinitionID is the unique identifier of the alert definition associated with the query.
		AlertDefinitionID int64 `json:"-"`
	*/

	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId"`

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType"`

	// RelativeTimeRange is the relative Start and End of the query as sent by the frontend.
	RelativeTimeRange RelativeTimeRange `json:"relativeTimeRange"`

	DatasourceID int64 `json:"-"`

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	Model json.RawMessage `json:"model"`

	modelProps map[string]interface{} `json:"-"`
}

func (aq *AlertQuery) setModelProps() error {
	aq.modelProps = make(map[string]interface{})
	err := json.Unmarshal(aq.Model, &aq.modelProps)
	if err != nil {
		return fmt.Errorf("failed to unmarshal query model %w", err)
	}

	return nil
}

func (aq *AlertQuery) setDatasource() error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}

	dsName, ok := aq.modelProps["datasource"]
	if !ok {
		return fmt.Errorf("failed to get datasource from query model")
	}

	if dsName == "__expr__" {
		aq.DatasourceID = defaultExprDatasourceID
		aq.modelProps["datasourceId"] = defaultExprDatasourceID
		return nil
	}

	i, ok := aq.modelProps["datasourceId"]
	if !ok {
		return fmt.Errorf("failed to get datasourceId from query model")
	}
	dsID, ok := i.(float64)
	if !ok {
		return fmt.Errorf("failed to cast datasourceId to float64")
	}
	aq.DatasourceID = int64(dsID)
	return nil
}

// IsExpression returns true is the alert query is an expression.
func (aq *AlertQuery) IsExpression() (bool, error) {
	err := aq.setDatasource()
	if err != nil {
		return false, err
	}
	return aq.DatasourceID == defaultExprDatasourceID, nil
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

func (aq *AlertQuery) getMaxDatapoints() (int64, error) {
	err := aq.setMaxDatapoints()
	if err != nil {
		return 0, err
	}

	maxDataPoints, ok := aq.modelProps["maxDataPoints"].(float64)
	if !ok {
		return 0, fmt.Errorf("Failed to cast maxDataPoints to float64")
	}
	return int64(maxDataPoints), nil
}

// setIntervalMs sets the model IntervalMs if it's missing or invalid
func (aq *AlertQuery) setIntervalMs() error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}
	i, ok := aq.modelProps["intervalMs"] // GEL requires intervalMs inside the query JSON
	if !ok {
		aq.modelProps["intervalMs"] = defaultIntervalMs
	}
	intervalMs, ok := i.(float64)
	if !ok || intervalMs == 0 {
		aq.modelProps["intervalMs"] = defaultIntervalMs
	}
	return nil
}

func (aq *AlertQuery) getIntervalMs() (int64, error) {
	err := aq.setIntervalMs()
	if err != nil {
		return 0, err
	}

	intervalMs, ok := aq.modelProps["intervalMs"].(float64)
	if !ok {
		return 0, fmt.Errorf("Failed to cast intervalMs to float64")
	}
	return int64(intervalMs), nil
}

func (aq *AlertQuery) getDatasource() (int64, error) {
	err := aq.setDatasource()
	if err != nil {
		return 0, err
	}
	return aq.DatasourceID, nil
}

func (aq *AlertQuery) getModel() ([]byte, error) {
	err := aq.setDatasource()
	if err != nil {
		return nil, err
	}

	err = aq.setMaxDatapoints()
	if err != nil {
		return nil, err
	}

	err = aq.setIntervalMs()
	if err != nil {
		return nil, err
	}

	model, err := json.Marshal(aq.modelProps)
	if err != nil {
		return nil, fmt.Errorf("unable to marshal query model %w", err)
	}
	return model, nil
}

func (aq *AlertQuery) setOrgID(orgID int64) error {
	if aq.modelProps == nil {
		err := aq.setModelProps()
		if err != nil {
			return err
		}
	}

	aq.modelProps["orgId"] = orgID
	return nil
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
		return fmt.Errorf("failed to get queryType from query model")
	}

	aq.QueryType = queryType
	return nil
}

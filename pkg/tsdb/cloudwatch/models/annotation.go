package models

import (
	"encoding/json"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type AnnotationQuery struct {
	QueryType       string `json:"type,omitempty"`
	PrefixMatching  bool
	Region          string
	Namespace       string
	MetricName      string
	Dimensions      map[string]interface{}
	Statistic       string
	Period          string
	PeriodInt       int64
	ActionPrefix    string
	AlarmNamePrefix string
}

func GetAnnotationQuery(dq *backend.DataQuery) (*AnnotationQuery, error) {
	var model AnnotationQuery
	err := json.Unmarshal(dq.JSON, &model)
	if err != nil {
		return nil, err
	}

	var period int64
	if model.Period != "" {
		p, err := strconv.ParseInt(model.Period, 10, 64)
		if err != nil {
			return nil, err
		}
		period = p
	}

	if period == 0 && !model.PrefixMatching {
		period = 300
	}

	model.PeriodInt = period

	return &model, nil
}

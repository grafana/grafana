package models

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"reflect"
)

// IndvMetric holds the information from an individual metric item coming in
// from rabbitmq.
type MetricDefinition struct {
	OrgId      int64                  `json:"org_id"`
	Name       string                 `json:"name"`
	Metric     string                 `json:"metric"`
	Interval   int64                  `json:"interval"`
	Value      float64                `json:"value"`
	Unit       string                 `json:"unit"`
	Time       int64                  `json:"time"`
	TargetType string                 `json:"target_type"`
	Tags       map[string]interface{} `json:"tags"`
}

package dtos

import (
	"time"

	eval "github.com/grafana/grafana/pkg/services/ngalert"
)

type EvalAlertConditionCommand struct {
	Condition eval.Condition `json:"condition"`
	Now       time.Time      `json:"now"`
}

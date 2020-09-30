package dtos

import (
	"time"

	eval "github.com/grafana/grafana/pkg/services/ngalert"
)

type EvalAlertConditionsCommand struct {
	Conditions eval.Conditions `json:"conditions"`
	Now        time.Time       `json:"now"`
}

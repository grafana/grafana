package alerting

import "github.com/grafana/grafana/pkg/components/null"

// Job holds state about when the alert rule should be evaluated.
type Job struct {
	Offset     int64
	OffsetWait bool
	Delay      bool
	Running    bool
	Rule       *Rule
}

// ResultLogEntry represents log data for the alert evaluation.
type ResultLogEntry struct {
	Message string
	Data    interface{}
}

// EvalMatch represents the serie violating the threshold.
type EvalMatch struct {
	Value  null.Float        `json:"value"`
	Metric string            `json:"metric"`
	Tags   map[string]string `json:"tags"`
}

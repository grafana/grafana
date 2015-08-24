package schema

import (
	"fmt"
	"strings"
)

type ProbeEvent struct {
	Id        string            `json:"id"`
	EventType string            `json:"event_type"`
	OrgId     int64             `json:"org_id"`
	Severity  string            `json:"severity"` // enum "INFO" "WARN" "ERROR" "OK"
	Source    string            `json:"source"`
	Timestamp int64             `json:"timestamp"`
	Message   string            `json:"message"`
	Tags      map[string]string `json:"tags"`
}

func (e *ProbeEvent) Validate() error {
	if e.EventType == "" || e.OrgId == 0 || e.Source == "" || e.Timestamp == 0 || e.Message == "" {
		return fmt.Errorf("event definition not valid")
	}
	switch strings.ToLower(e.Severity) {
	case "info", "ok", "warn", "error", "warning", "critical":
		// nop
	default:
		return fmt.Errorf("'%s' is not a valid severity level", e.Severity)
	}
	return nil
}

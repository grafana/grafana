package v0alpha1

import (
	"encoding/json"
	"time"
)

type AlertStateHistoryEntry struct {
	Timestamp     time.Time         `json:"timestamp"`
	SchemaVersion int               `json:"schemaVersion"`
	Previous      string            `json:"previous"`
	Current       string            `json:"current"`
	Error         string            `json:"error,omitempty"`
	Values        json.RawMessage   `json:"values"`
	Condition     string            `json:"condition"`
	DashboardUID  string            `json:"dashboardUID"`
	PanelID       int64             `json:"panelID"`
	Fingerprint   string            `json:"fingerprint"`
	RuleTitle     string            `json:"ruleTitle"`
	RuleID        int64             `json:"ruleID"`
	RuleUID       string            `json:"ruleUID"`
	Labels        map[string]string `json:"labels"`
}

type AlertStateHistoryResponse struct {
	Entries []AlertStateHistoryEntry `json:"entries"`
}

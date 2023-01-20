package models

import "time"

// HistoryQuery represents a query for alert state history.
type HistoryQuery struct {
	RuleUID string
	OrgID   int64
	Labels  map[string]string
	From    time.Time
	To      time.Time
}

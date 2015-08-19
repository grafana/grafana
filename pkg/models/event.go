package models

type CollectorEventDefinition struct {
	Id        string            `json:"id"`
	EventType string            `json:"event_type"`
	OrgId     int64             `json:"org_id"`
	Severity  string            `json:"severity"` // enum "INFO" "WARN" "ERROR" "OK"
	Source    string            `json:"source"`
	Timestamp int64             `json:"timestamp"`
	Message   string            `json:"message"`
	Tags      map[string]string `json:"tags"`
}

// ---------------------
// QUERIES

type GetEventsQuery struct {
	OrgId  int64
	Query  string `form:"query"`
	Start  int64  `form:"start"`
	End    int64  `form:"end"`
	Size   int    `form:"size"`
	Result []*CollectorEventDefinition
}

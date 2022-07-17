package entity

import "time"

// Where did it come from
type EntityHistory struct {
	When    time.Time `json:"updatedAt" yaml:"updatedAt"`
	Who     string
	Version string
	Comment string
}

type HistoryResponse struct {
	UID       string
	Authors   []string        // the distinct users that have saved this item
	Items     []EntityHistory // without body and limited meta
	NextToken string
}

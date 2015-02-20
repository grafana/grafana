package models

// ---------------------
// QUERIES

type GetEventsQuery struct {
	AccountId       int64
	Query           string     `form:"query"`
	Start           int64      `form:"start"`
	End             int64      `form:"end"`
	Size            int        `form:"size"`
	Result          []map[string]interface{}
}


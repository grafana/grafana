package tsdb

import "sync"

type QueryContext struct {
	TimeRange   *TimeRange
	Queries     QuerySlice
	Results     map[string]*QueryResult
	ResultsChan chan *BatchResult `json:"-"`
	Lock        sync.RWMutex      `json:"-"`
	BatchWaits  sync.WaitGroup    `json:"-"`
}

func NewQueryContext(queries QuerySlice, timeRange *TimeRange) *QueryContext {
	return &QueryContext{
		TimeRange:   timeRange,
		Queries:     queries,
		ResultsChan: make(chan *BatchResult),
		Results:     make(map[string]*QueryResult),
	}
}

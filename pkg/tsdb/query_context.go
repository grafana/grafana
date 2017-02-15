package tsdb

import "sync"

type QueryContext struct {
	TimeRange   *TimeRange
	Queries     QuerySlice
	Results     map[string]*QueryResult
	ResultsChan chan *BatchResult
	Lock        sync.RWMutex
	BatchWaits  sync.WaitGroup
}

func NewQueryContext(queries QuerySlice, timeRange *TimeRange) *QueryContext {
	return &QueryContext{
		TimeRange:   timeRange,
		Queries:     queries,
		ResultsChan: make(chan *BatchResult),
		Results:     make(map[string]*QueryResult),
	}
}

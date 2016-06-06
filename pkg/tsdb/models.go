package tsdb

import "time"

type TimeRange struct {
	From time.Time
	To   time.Time
}

type Request struct {
	TimeRange     TimeRange
	MaxDataPoints int
	Queries       QuerySlice
}

type Response struct {
	BatchTimings []*BatchTiming
	Results      map[string]*QueryResult
}

type DataSourceInfo struct {
	Id                int64
	Name              string
	Type              string
	Url               string
	Password          string
	User              string
	Database          string
	BasicAuth         bool
	BasicAuthUser     string
	BasicAuthPassword string
}

type BatchTiming struct {
	TimeElapsed int64
}

type BatchResult struct {
	Error        error
	QueryResults map[string]*QueryResult
	Timings      *BatchTiming
}

type QueryResult struct {
	Error  error
	RefId  string
	Series TimeSeriesSlice
}

type TimeSeries struct {
	Name   string
	Points [][2]float64
}

type TimeSeriesSlice []*TimeSeries

func NewTimeSeries(name string, points [][2]float64) *TimeSeries {
	return &TimeSeries{
		Name:   name,
		Points: points,
	}
}

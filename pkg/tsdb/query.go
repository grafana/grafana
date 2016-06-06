package tsdb

type Query struct {
	RefId      string
	Query      string
	Depends    []string
	DataSource *DataSourceInfo
	Results    []*TimeSeries
	Exclude    bool
}

type QuerySlice []*Query

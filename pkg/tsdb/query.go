package tsdb

import "github.com/grafana/grafana/pkg/components/simplejson"

type Query struct {
	RefId      string
	Query      *simplejson.Json
	Depends    []string
	DataSource *DataSourceInfo
	Results    []*TimeSeries
	Exclude    bool
}

type QuerySlice []*Query

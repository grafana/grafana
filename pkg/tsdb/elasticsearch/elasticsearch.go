package elasticsearch

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// ElasticsearchExecutor represents a handler for handling elasticsearch datasource request
type ElasticsearchExecutor struct{}

var (
	intervalCalculator tsdb.IntervalCalculator
)

// NewElasticsearchExecutor creates a new elasticsearch executor
func NewElasticsearchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &ElasticsearchExecutor{}, nil
}

func init() {
	intervalCalculator = tsdb.NewIntervalCalculator(nil)
	tsdb.RegisterTsdbQueryEndpoint("elasticsearch", NewElasticsearchExecutor)
}

// Query handles an elasticsearch datasource request
func (e *ElasticsearchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	if len(tsdbQuery.Queries) == 0 {
		return nil, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, tsdbQuery.TimeRange)
	if err != nil {
		return nil, err
	}

	if tsdbQuery.Debug {
		client.EnableDebug()
	}

	var queryType string
	var query queryEndpoint

	if qt, ok := tsdbQuery.Queries[0].Model.CheckGet("queryType"); ok {
		queryType = qt.MustString("timeseries")
	}

	switch queryType {
	case "fields":
		query = newFieldsQuery(client, tsdbQuery)
	case "terms":
		query = newTermsQuery(client, tsdbQuery)
	case "timeseries":
		fallthrough
	default:
		query = newTimeSeriesQuery(client, tsdbQuery, intervalCalculator)
	}

	res, err := query.execute()
	if err != nil {
		return res, err
	}
	enrichResponseWithMeta(client, tsdbQuery, res)
	return res, nil
}

func enrichResponseWithMeta(client es.Client, tsdbQuery *tsdb.TsdbQuery, res *tsdb.Response) {
	meta := client.GetMeta()
	if len(meta) == 0 {
		return
	}

	firstQuery := tsdbQuery.Queries[0]

	if res == nil {
		res = &tsdb.Response{}
	}

	if len(res.Results) == 0 {
		res.Results = map[string]*tsdb.QueryResult{
			firstQuery.RefId: {
				Meta: simplejson.NewFromAny(meta),
			},
		}
	} else {
		if res.Results[firstQuery.RefId].Meta == nil {
			res.Results[firstQuery.RefId].Meta = simplejson.NewFromAny(meta)
		} else {
			for k, v := range res.Results[firstQuery.RefId].Meta.MustMap() {
				res.Results[firstQuery.RefId].Meta.Set(k, v)
				break
			}
		}
	}
}

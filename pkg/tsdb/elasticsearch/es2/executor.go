package es2

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
	esmodel "github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	elastic "gopkg.in/olivere/elastic.v3"
)

func Execute(e *esmodel.ESDataSource, ctx context.Context, queries tsdb.QuerySlice, query *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{
		QueryResults: map[string]*tsdb.QueryResult{},
		Timings:      &tsdb.BatchTiming{TimeElapsed: 0},
	}
	p := esmodel.GetIndicesRanger(e.IndexInterval)
	indices := p.FilterIndices(e.IndexPrefix, e.IndexPattern, query.TimeRange)

	startQuery := time.Now().UnixNano()
	for _, q := range queries {
		url := elastic.SetURL(q.DataSource.Url)
		basicAuth := elastic.SetBasicAuth(q.DataSource.BasicAuthUser, q.DataSource.BasicAuthPassword)
		cli, err := elastic.NewSimpleClient(url, basicAuth)
		if err != nil {
			result.WithError(err)
			return result
		}
		sr, err := InstanceESQueryParser.SearchRequest(query.TimeRange, q.Model, e)
		if err != nil {
			result.WithError(err)
			return result
		}
		service := cli.MultiSearch().Index(indices...).Add(sr).Pretty(true)
		ret, err := service.DoC(ctx)
		if err != nil {
			result.WithError(err)
			return result
		}
		qr, err := InstanceESResponseParser.Parse(q, ret)
		if err != nil {
			result.WithError(err)
			return result
		}
		if qr != nil {
			result.QueryResults[q.RefId] = qr
		}
	}
	result.Timings.TimeElapsed = (time.Now().UnixNano() - startQuery) / 1000000
	return result
}

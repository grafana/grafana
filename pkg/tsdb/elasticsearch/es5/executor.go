package es5

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	esmodel "github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	elastic "gopkg.in/olivere/elastic.v5"
)

func Execute(e *esmodel.ESDataSource, ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}
	p := esmodel.GetIndicesRanger(e.IndexInterval)
	indices := p.FilterIndices(e.IndexPrefix, e.IndexPattern, query.TimeRange)

	for _, q := range query.Queries {
		url := elastic.SetURL(q.DataSource.Url)
		basicAuth := elastic.SetBasicAuth(q.DataSource.BasicAuthUser, q.DataSource.BasicAuthPassword)
		cli, err := elastic.NewSimpleClient(url, basicAuth)
		if err != nil {
			result.Message = err.Error()
			return result, err
		}
		sr, err := InstanceESQueryParser.SearchRequest(query.TimeRange, q.Model, e)
		if err != nil {
			result.Message = err.Error()
			return result, err
		}
		service := cli.MultiSearch().Index(indices...).Add(sr).Pretty(true)
		ret, err := service.Do(ctx)
		if err != nil {
			result.Message = err.Error()
			return result, err
		}
		qr, err := InstanceESResponseParser.Parse(q, ret)
		if err != nil {
			result.Message = err.Error()
			return result, err
		}
		if qr != nil {
			result.Results[q.RefId] = qr
		}
	}
	return result, nil
}

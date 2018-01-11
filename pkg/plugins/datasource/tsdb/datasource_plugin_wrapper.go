package tsdb

import (
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	proto "github.com/grafana/grafana/pkg/tsdb/models"
	"golang.org/x/net/context"
)

type DatasourcePluginWrapper struct {
	TsdbPlugin
}

func (tw *DatasourcePluginWrapper) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonData, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	pbQuery := &proto.TsdbQuery{
		Datasource: &proto.DatasourceInfo{
			JsonData: string(jsonData),
			Name:     ds.Name,
			Type:     ds.Type,
			Url:      ds.Url,
			Id:       ds.Id,
			OrgId:    ds.OrgId,
		},
		TimeRange: &proto.TimeRange{
			FromRaw:     query.TimeRange.From,
			ToRaw:       query.TimeRange.To,
			ToEpochMs:   query.TimeRange.GetToAsMsEpoch(),
			FromEpochMs: query.TimeRange.GetFromAsMsEpoch(),
		},
		Queries: []*proto.Query{},
	}

	for _, q := range query.Queries {
		modelJson, _ := q.Model.MarshalJSON()

		pbQuery.Queries = append(pbQuery.Queries, &proto.Query{
			ModelJson:     string(modelJson),
			IntervalMs:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
		})
	}

	pbres, err := tw.TsdbPlugin.Query(ctx, pbQuery)

	if err != nil {
		return nil, err
	}

	res := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	for _, r := range pbres.Results {
		res.Results[r.RefId] = &tsdb.QueryResult{
			RefId:  r.RefId,
			Series: []*tsdb.TimeSeries{},
		}

		for _, s := range r.Series {
			points := tsdb.TimeSeriesPoints{}

			for _, p := range s.Points {
				po := tsdb.NewTimePoint(null.FloatFrom(p.Value), float64(p.Timestamp))
				points = append(points, po)
			}

			res.Results[r.RefId].Series = append(res.Results[r.RefId].Series, &tsdb.TimeSeries{
				Name:   s.Name,
				Tags:   s.Tags,
				Points: points,
			})
		}
	}

	return res, nil
}

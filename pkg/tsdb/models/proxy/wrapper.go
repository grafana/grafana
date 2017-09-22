package proxy

import (
	"github.com/golang/protobuf/ptypes"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	proto "github.com/grafana/grafana/pkg/tsdb/models"
	"golang.org/x/net/context"
)

type TsdbWrapper struct {
	TsdbPlugin
}

func (tw *TsdbWrapper) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonData, _ := ds.JsonData.MarshalJSON()
	now, _ := ptypes.TimestampProto(query.TimeRange.Now)

	pbQuery := &proto.TsdbQuery{
		Datasource: &proto.DatasourceInfo{
			Access:            string(ds.Access),
			BasicAuth:         ds.BasicAuth,
			BasicAuthUser:     ds.BasicAuthUser,
			BasicAuthPassword: ds.BasicAuthPassword,
			JsonData:          string(jsonData),
			Name:              ds.Name,
			Type:              ds.Type,
			Url:               ds.Url,
		},
		Timerange: &proto.Timerange{
			From: query.TimeRange.From,
			To:   query.TimeRange.To,
			Now:  now,
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
		Message: pbres.Message,
	}

	for _, r := range pbres.Results {
		res.Results[r.RefId] = &tsdb.QueryResult{
			RefId:  r.RefId,
			Series: []*tsdb.TimeSeries{},
		}

		for _, s := range r.Series {
			points := tsdb.TimeSeriesPoints{}

			for _, p := range s.Points {
				po := tsdb.NewTimePoint(null.FloatFrom(float64(p.Timestamp.Nanos)), p.Value)
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

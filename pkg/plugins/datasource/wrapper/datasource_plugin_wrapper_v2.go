package wrapper

import (
	"context"

	sdk "github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func NewDatasourcePluginWrapperV2(log log.Logger, plugin sdk.Plugin) *DatasourcePluginWrapperV2 {
	return &DatasourcePluginWrapperV2{Plugin: plugin, logger: log}
}

type DatasourcePluginWrapperV2 struct {
	sdk.Plugin
	logger log.Logger
}

func (tw *DatasourcePluginWrapperV2) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonData, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	pbQuery := &pluginv2.DataQueryRequest{
		Config: &pluginv2.PluginConfig{
			Name:                    ds.Name,
			Type:                    ds.Type,
			Url:                     ds.Url,
			Id:                      ds.Id,
			OrgId:                   ds.OrgId,
			JsonData:                string(jsonData),
			DecryptedSecureJsonData: ds.SecureJsonData.Decrypt(),
		},
		Queries: []*pluginv2.DataQuery{},
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		pbQuery.Queries = append(pbQuery.Queries, &pluginv2.DataQuery{
			Json:          modelJSON,
			IntervalMS:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange: &pluginv2.TimeRange{
				ToEpochMS:   query.TimeRange.GetToAsMsEpoch(),
				FromEpochMS: query.TimeRange.GetFromAsMsEpoch(),
			},
		})
	}

	_, err = tw.Plugin.DataQuery(ctx, pbQuery)

	if err != nil {
		return nil, err
	}

	res := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	// qr := &tsdb.QueryResult{
	// RefId: r.RefId,
	// }

	// if r.Error != "" {
	// 	qr.Error = errors.New(r.Error)
	// 	qr.ErrorString = r.Error
	// }

	// if pbres.Metadata != "" {
	// 	metaJSON, err := simplejson.NewJson([]byte(pbres.Metadata))
	// 	if err != nil {
	// 		tw.logger.Error("Error parsing JSON Meta field: " + err.Error())
	// 	}
	// 	qr.Meta = metaJSON
	// }
	// qr.Dataframes = pbres.Frames

	// res.Results[r.RefId] = qr

	return res, nil
}

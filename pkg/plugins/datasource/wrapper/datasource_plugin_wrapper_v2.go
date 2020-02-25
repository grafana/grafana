package wrapper

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func NewDatasourcePluginWrapperV2(log log.Logger, pluginId, pluginType string, plugin backendplugin.DatasourcePlugin) *DatasourcePluginWrapperV2 {
	return &DatasourcePluginWrapperV2{DatasourcePlugin: plugin, logger: log, pluginId: pluginId, pluginType: pluginType}
}

type DatasourcePluginWrapperV2 struct {
	backendplugin.DatasourcePlugin
	logger     log.Logger
	pluginId   string
	pluginType string
}

func (tw *DatasourcePluginWrapperV2) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonDataBytes, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	pbQuery := &pluginv2.DataQueryRequest{
		Config: &pluginv2.PluginConfig{
			OrgId:                   ds.OrgId,
			PluginId:                tw.pluginId,
			PluginType:              tw.pluginType,
			UpdatedMS:               ds.Updated.UnixNano() / int64(time.Millisecond),
			JsonData:                jsonDataBytes,
			DecryptedSecureJsonData: ds.DecryptedValues(),
			DatasourceConfig: &pluginv2.DataSourceConfig{
				Id:               ds.Id,
				Name:             ds.Name,
				Url:              ds.Url,
				Database:         ds.Database,
				User:             ds.User,
				BasicAuthEnabled: ds.BasicAuth,
				BasicAuthUser:    ds.BasicAuthUser,
			},
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

	pbRes, err := tw.DatasourcePlugin.DataQuery(ctx, pbQuery)
	if err != nil {
		return nil, err
	}

	return &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"": {
				Dataframes: pbRes.Frames,
				Meta:       simplejson.NewFromAny(pbRes.Metadata),
			},
		},
	}, nil
}

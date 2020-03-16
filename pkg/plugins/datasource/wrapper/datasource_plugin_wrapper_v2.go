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

func NewDatasourcePluginWrapperV2(log log.Logger, pluginId, pluginType string, plugin backendplugin.DataPlugin) *DatasourcePluginWrapperV2 {
	return &DatasourcePluginWrapperV2{DataPlugin: plugin, logger: log, pluginId: pluginId, pluginType: pluginType}
}

type DatasourcePluginWrapperV2 struct {
	backendplugin.DataPlugin
	logger     log.Logger
	pluginId   string
	pluginType string
}

func (tw *DatasourcePluginWrapperV2) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonDataBytes, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	pbQuery := &pluginv2.QueryDataRequest{
		Config: &pluginv2.PluginConfig{
			OrgId:         ds.OrgId,
			PluginId:      tw.pluginId,
			LastUpdatedMS: ds.Updated.UnixNano() / int64(time.Millisecond),
			DatasourceConfig: &pluginv2.DataSourceConfig{
				Id:                      ds.Id,
				Name:                    ds.Name,
				Url:                     ds.Url,
				Database:                ds.Database,
				User:                    ds.User,
				BasicAuthEnabled:        ds.BasicAuth,
				BasicAuthUser:           ds.BasicAuthUser,
				JsonData:                jsonDataBytes,
				DecryptedSecureJsonData: ds.DecryptedValues(),
			},
		},
		Queries: []*pluginv2.DataQuery{},
	}

	if query.User != nil {
		pbQuery.User = &pluginv2.User{
			Name:  query.User.Name,
			Login: query.User.Login,
			Email: query.User.Email,
			Role:  string(query.User.OrgRole),
		}
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

	pbRes, err := tw.DataPlugin.QueryData(ctx, pbQuery)
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

package models

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/models/adapters"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

func newDataSourcePluginWrapperV2(log log.Logger, pluginId, pluginType string, client grpcplugin.DataClient) *DatasourcePluginWrapperV2 {
	return &DatasourcePluginWrapperV2{DataClient: client, logger: log, pluginId: pluginId, pluginType: pluginType}
}

type DatasourcePluginWrapperV2 struct {
	grpcplugin.DataClient
	logger     log.Logger
	pluginId   string
	pluginType string
}

func (tw *DatasourcePluginWrapperV2) Query(ctx context.Context, ds *models.DataSource, query TSDBQuery) (TSDBResponse, error) {
	instanceSettings, err := adapters.ModelToInstanceSettings(ds)
	if err != nil {
		return TSDBResponse{}, err
	}

	if query.Headers == nil {
		query.Headers = make(map[string]string)
	}

	if oauthtoken.IsOAuthPassThruEnabled(ds) {
		if token := oauthtoken.GetCurrentOAuthToken(ctx, query.User); token != nil {
			delete(query.Headers, "Authorization")
			query.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
		}
	}

	pbQuery := &pluginv2.QueryDataRequest{
		PluginContext: &pluginv2.PluginContext{
			OrgId:                      ds.OrgId,
			PluginId:                   tw.pluginId,
			User:                       backend.ToProto().User(adapters.BackendUserFromSignedInUser(query.User)),
			DataSourceInstanceSettings: backend.ToProto().DataSourceInstanceSettings(instanceSettings),
		},
		Queries: []*pluginv2.DataQuery{},
		Headers: query.Headers,
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return TSDBResponse{}, err
		}
		pbQuery.Queries = append(pbQuery.Queries, &pluginv2.DataQuery{
			Json:          modelJSON,
			IntervalMS:    q.IntervalMS,
			RefId:         q.RefID,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange: &pluginv2.TimeRange{
				ToEpochMS:   query.TimeRange.GetToAsMsEpoch(),
				FromEpochMS: query.TimeRange.GetFromAsMsEpoch(),
			},
			QueryType: q.QueryType,
		})
	}

	pbRes, err := tw.DataClient.QueryData(ctx, pbQuery)
	if err != nil {
		return TSDBResponse{}, err
	}

	tR := TSDBResponse{
		Results: make(map[string]TSDBQueryResult, len(pbRes.Responses)),
	}

	for refID, pRes := range pbRes.Responses {
		qr := TSDBQueryResult{
			RefID:      refID,
			Dataframes: NewEncodedDataFrames(pRes.Frames),
		}
		if len(pRes.JsonMeta) != 0 {
			qr.Meta = simplejson.NewFromAny(pRes.JsonMeta)
		}
		if pRes.Error != "" {
			qr.Error = fmt.Errorf(pRes.Error)
			qr.ErrorString = pRes.Error
		}
		tR.Results[refID] = qr
	}

	return tR, nil
}

package wrapper

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func NewDatasourcePluginWrapperV2(log log.Logger, pluginId, pluginType string, client grpcplugin.DataClient) *DatasourcePluginWrapperV2 {
	return &DatasourcePluginWrapperV2{DataClient: client, logger: log, pluginId: pluginId, pluginType: pluginType}
}

type DatasourcePluginWrapperV2 struct {
	grpcplugin.DataClient
	logger     log.Logger
	pluginId   string
	pluginType string
}

func ModelToInstanceSettings(ds *models.DataSource) (*backend.DataSourceInstanceSettings, error) {
	jsonDataBytes, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return &backend.DataSourceInstanceSettings{
		ID:                      ds.Id,
		Name:                    ds.Name,
		URL:                     ds.Url,
		Database:                ds.Database,
		User:                    ds.User,
		BasicAuthEnabled:        ds.BasicAuth,
		BasicAuthUser:           ds.BasicAuthUser,
		JSONData:                jsonDataBytes,
		DecryptedSecureJSONData: ds.DecryptedValues(),
		Updated:                 ds.Updated,
	}, nil
}

func (tw *DatasourcePluginWrapperV2) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	instanceSettings, err := ModelToInstanceSettings(ds)
	if err != nil {
		return nil, err
	}

	pbQuery := &pluginv2.QueryDataRequest{
		PluginContext: &pluginv2.PluginContext{
			OrgId:                      ds.OrgId,
			PluginId:                   tw.pluginId,
			User:                       backend.ToProto().User(BackendUserFromSignedInUser(query.User)),
			DataSourceInstanceSettings: backend.ToProto().DataSourceInstanceSettings(instanceSettings),
		},
		Queries: []*pluginv2.DataQuery{},
		Headers: query.Headers,
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
			QueryType: q.QueryType,
		})
	}

	pbRes, err := tw.DataClient.QueryData(ctx, pbQuery)
	if err != nil {
		return nil, err
	}

	tR := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult, len(pbRes.Responses)),
	}

	for refID, pRes := range pbRes.Responses {
		qr := &tsdb.QueryResult{
			RefId:      refID,
			Dataframes: tsdb.NewEncodedDataFrames(pRes.Frames),
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

// BackendUserFromSignedInUser converts Grafana's SignedInUser model
// to the backend plugin's model.
func BackendUserFromSignedInUser(su *models.SignedInUser) *backend.User {
	if su == nil {
		return nil
	}
	return &backend.User{
		Login: su.Login,
		Name:  su.Name,
		Email: su.Name,
		Role:  string(su.OrgRole),
	}
}

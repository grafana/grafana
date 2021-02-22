package coreplugin

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
	"github.com/grafana/grafana/pkg/plugins/models/adapters"
)

func newQueryEndpointAdapter(pluginID string, logger log.Logger, handler backend.QueryDataHandler) pluginmodels.TSDBPlugin {
	return &queryEndpointAdapter{
		pluginID: pluginID,
		logger:   logger,
		handler:  handler,
	}
}

type queryEndpointAdapter struct {
	pluginID string
	logger   log.Logger
	handler  backend.QueryDataHandler
}

func modelToInstanceSettings(ds *models.DataSource) (*backend.DataSourceInstanceSettings, error) {
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

func (a *queryEndpointAdapter) TSDBQuery(ctx context.Context, ds *models.DataSource, query pluginmodels.TSDBQuery) (
	pluginmodels.TSDBResponse, error) {
	instanceSettings, err := modelToInstanceSettings(ds)
	if err != nil {
		return pluginmodels.TSDBResponse{}, err
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgId,
			PluginID:                   a.pluginID,
			User:                       adapters.BackendUserFromSignedInUser(query.User),
			DataSourceInstanceSettings: instanceSettings,
		},
		Queries: []backend.DataQuery{},
		Headers: query.Headers,
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return pluginmodels.TSDBResponse{}, err
		}
		req.Queries = append(req.Queries, backend.DataQuery{
			RefID:         q.RefID,
			Interval:      time.Duration(q.IntervalMS) * time.Millisecond,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange: backend.TimeRange{
				From: query.TimeRange.GetFromAsTimeUTC(),
				To:   query.TimeRange.GetToAsTimeUTC(),
			},
			QueryType: q.QueryType,
			JSON:      modelJSON,
		})
	}

	resp, err := a.handler.QueryData(ctx, req)
	if err != nil {
		return pluginmodels.TSDBResponse{}, err
	}

	tR := pluginmodels.TSDBResponse{
		Results: make(map[string]pluginmodels.TSDBQueryResult, len(resp.Responses)),
	}

	for refID, r := range resp.Responses {
		qr := pluginmodels.TSDBQueryResult{
			RefID: refID,
		}

		for _, f := range r.Frames {
			if f.RefID == "" {
				f.RefID = refID
			}
		}

		qr.Dataframes = pluginmodels.NewDecodedDataFrames(r.Frames)

		if r.Error != nil {
			qr.Error = r.Error
		}

		tR.Results[refID] = qr
	}

	return tR, nil
}

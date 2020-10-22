package coreplugin

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/datasource/wrapper"
	"github.com/grafana/grafana/pkg/tsdb"
)

func newQueryEndpointAdapter(pluginID string, logger log.Logger, handler backend.QueryDataHandler) tsdb.TsdbQueryEndpoint {
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

func (a *queryEndpointAdapter) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	instanceSettings, err := modelToInstanceSettings(ds)
	if err != nil {
		return nil, err
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgId,
			PluginID:                   a.pluginID,
			User:                       wrapper.BackendUserFromSignedInUser(query.User),
			DataSourceInstanceSettings: instanceSettings,
		},
		Queries: []backend.DataQuery{},
		Headers: query.Headers,
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		req.Queries = append(req.Queries, backend.DataQuery{
			RefID:         q.RefId,
			Interval:      time.Duration(q.IntervalMs) * time.Millisecond,
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
		return nil, err
	}

	tR := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult, len(resp.Responses)),
	}

	for refID, r := range resp.Responses {
		qr := &tsdb.QueryResult{
			RefId: refID,
		}

		for _, f := range r.Frames {
			if f.RefID == "" {
				f.RefID = refID
			}
		}

		qr.Dataframes = tsdb.NewDecodedDataFrames(r.Frames)

		if r.Error != nil {
			qr.Error = r.Error
		}

		tR.Results[refID] = qr
	}

	return tR, nil
}

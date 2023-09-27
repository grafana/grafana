package service

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type Service struct {
	pluginsClient      plugins.Client
	oAuthTokenService  oauthtoken.OAuthTokenService
	dataSourcesService datasources.DataSourceService
	pCtxProvider       *plugincontext.Provider
}

func ProvideService(pluginsClient plugins.Client, oAuthTokenService oauthtoken.OAuthTokenService,
	dataSourcesService datasources.DataSourceService, pCtxProvider *plugincontext.Provider) *Service {
	return &Service{
		pluginsClient:      pluginsClient,
		oAuthTokenService:  oAuthTokenService,
		dataSourcesService: dataSourcesService,
		pCtxProvider:       pCtxProvider,
	}
}

//nolint:staticcheck // legacydata.DataResponse deprecated
func (h *Service) HandleRequest(ctx context.Context, ds *datasources.DataSource, query legacydata.DataQuery) (legacydata.DataResponse, error) {
	req, err := h.generateRequest(ctx, ds, query)
	if err != nil {
		return legacydata.DataResponse{}, err
	}

	resp, err := h.pluginsClient.QueryData(ctx, req)
	if err != nil {
		return legacydata.DataResponse{}, err
	}

	tR := legacydata.DataResponse{
		Results: make(map[string]legacydata.DataQueryResult, len(resp.Responses)),
	}

	for refID, r := range resp.Responses {
		qr := legacydata.DataQueryResult{
			RefID: refID,
		}

		for _, f := range r.Frames {
			if f.RefID == "" {
				f.RefID = refID
			}
		}

		qr.Dataframes = legacydata.NewDecodedDataFrames(r.Frames)

		if r.Error != nil {
			qr.Error = r.Error
		}

		tR.Results[refID] = qr
	}

	return tR, nil
}

func (h *Service) generateRequest(ctx context.Context, ds *datasources.DataSource, query legacydata.DataQuery) (*backend.QueryDataRequest, error) {
	if query.Headers == nil {
		query.Headers = make(map[string]string)
	}

	pCtx, err := h.pCtxProvider.GetWithDataSource(ctx, ds.Type, query.User, ds)
	if err != nil {
		return nil, err
	}

	req := &backend.QueryDataRequest{
		PluginContext: pCtx,
		Queries:       []backend.DataQuery{},
		Headers:       query.Headers,
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
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
	return req, nil
}

var _ legacydata.RequestHandler = &Service{}

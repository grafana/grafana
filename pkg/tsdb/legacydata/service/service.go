package service

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

var oAuthIsOAuthPassThruEnabledFunc = func(oAuthTokenService oauthtoken.OAuthTokenService, ds *datasources.DataSource) bool {
	return oAuthTokenService.IsOAuthPassThruEnabled(ds)
}

type Service struct {
	pluginsClient      plugins.Client
	oAuthTokenService  oauthtoken.OAuthTokenService
	dataSourcesService datasources.DataSourceService
}

func ProvideService(pluginsClient plugins.Client, oAuthTokenService oauthtoken.OAuthTokenService,
	dataSourcesService datasources.DataSourceService) *Service {
	return &Service{
		pluginsClient:      pluginsClient,
		oAuthTokenService:  oAuthTokenService,
		dataSourcesService: dataSourcesService,
	}
}

//nolint:staticcheck // legacydata.DataResponse deprecated
func (h *Service) HandleRequest(ctx context.Context, ds *datasources.DataSource, query legacydata.DataQuery) (legacydata.DataResponse, error) {
	decryptedJsonData, err := h.dataSourcesService.DecryptedValues(ctx, ds)
	if err != nil {
		return legacydata.DataResponse{}, err
	}

	req, err := generateRequest(ctx, ds, decryptedJsonData, query)
	if err != nil {
		return legacydata.DataResponse{}, err
	}

	// Attach Auth information
	if oAuthIsOAuthPassThruEnabledFunc(h.oAuthTokenService, ds) {
		if token := h.oAuthTokenService.GetCurrentOAuthToken(ctx, query.User); token != nil {
			query.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
		}
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

func generateRequest(ctx context.Context, ds *datasources.DataSource, decryptedJsonData map[string]string, query legacydata.DataQuery) (*backend.QueryDataRequest, error) {
	jsonDataBytes, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	instanceSettings := &backend.DataSourceInstanceSettings{
		ID:                      ds.Id,
		Name:                    ds.Name,
		URL:                     ds.Url,
		Database:                ds.Database,
		User:                    ds.User,
		BasicAuthEnabled:        ds.BasicAuth,
		BasicAuthUser:           ds.BasicAuthUser,
		JSONData:                jsonDataBytes,
		DecryptedSecureJSONData: decryptedJsonData,
		Updated:                 ds.Updated,
		UID:                     ds.Uid,
	}

	if query.Headers == nil {
		query.Headers = make(map[string]string)
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgId,
			PluginID:                   ds.Type,
			User:                       adapters.BackendUserFromSignedInUser(query.User),
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

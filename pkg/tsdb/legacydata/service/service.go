package service

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

var oAuthIsOAuthPassThruEnabledFunc = func(oAuthTokenService oauthtoken.OAuthTokenService, ds *models.DataSource) bool {
	return oAuthTokenService.IsOAuthPassThruEnabled(ds)
}

type Service struct {
	pluginsClient      plugins.Client
	oAuthTokenService  oauthtoken.OAuthTokenService
	dataSourcesService *datasources.Service
}

func ProvideService(pluginsClient plugins.Client, oAuthTokenService oauthtoken.OAuthTokenService, dataSourcesService *datasources.Service) *Service {
	return &Service{
		pluginsClient:      pluginsClient,
		oAuthTokenService:  oAuthTokenService,
		dataSourcesService: dataSourcesService,
	}
}

//nolint: staticcheck // legacydata.DataResponse deprecated
func (h *Service) HandleRequest(ctx context.Context, ds *models.DataSource, query legacydata.DataQuery) (legacydata.DataResponse, error) {
	jsonDataBytes, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return legacydata.DataResponse{}, err
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
		DecryptedSecureJSONData: h.dataSourcesService.DecryptedValues(ds),
		Updated:                 ds.Updated,
		UID:                     ds.Uid,
	}

	if query.Headers == nil {
		query.Headers = make(map[string]string)
	}

	if oAuthIsOAuthPassThruEnabledFunc(h.oAuthTokenService, ds) {
		if token := h.oAuthTokenService.GetCurrentOAuthToken(ctx, query.User); token != nil {
			delete(query.Headers, "Authorization")
			query.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
		}
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
			return legacydata.DataResponse{}, err
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

var _ legacydata.RequestHandler = &Service{}

package tsdb

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

// nolint:staticcheck // plugins.DataQuery deprecated
func dataPluginQueryAdapter(pluginID string, handler backend.QueryDataHandler) plugins.DataPluginFunc {
	return plugins.DataPluginFunc(func(ctx context.Context, ds *models.DataSource, query plugins.DataQuery) (plugins.DataResponse, error) {
		instanceSettings, err := modelToInstanceSettings(ds)
		if err != nil {
			return plugins.DataResponse{}, err
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

		req := &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				OrgID:                      ds.OrgId,
				PluginID:                   pluginID,
				User:                       adapters.BackendUserFromSignedInUser(query.User),
				DataSourceInstanceSettings: instanceSettings,
			},
			Queries: []backend.DataQuery{},
			Headers: query.Headers,
		}

		for _, q := range query.Queries {
			modelJSON, err := q.Model.MarshalJSON()
			if err != nil {
				return plugins.DataResponse{}, err
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

		resp, err := handler.QueryData(ctx, req)
		if err != nil {
			return plugins.DataResponse{}, err
		}

		tR := plugins.DataResponse{
			Results: make(map[string]plugins.DataQueryResult, len(resp.Responses)),
		}

		for refID, r := range resp.Responses {
			qr := plugins.DataQueryResult{
				RefID: refID,
			}

			for _, f := range r.Frames {
				if f.RefID == "" {
					f.RefID = refID
				}
			}

			qr.Dataframes = plugins.NewDecodedDataFrames(r.Frames)

			if r.Error != nil {
				qr.Error = r.Error
			}

			tR.Results[refID] = qr
		}

		return tR, nil
	})
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
		UID:                     ds.Uid,
	}, nil
}

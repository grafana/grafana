package clientmiddleware

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// NewTeamHTTPHeaderMiddleware creates a new plugins.ClientMiddleware that will
// set headers based on teams user is member of.
func NewTeamHTTPHeadersMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &TeamHTTPHeadersMiddleware{
			next: next,
		}
	})
}

type TeamHTTPHeadersMiddleware struct {
	next plugins.Client
}

type TeamHTTPHeadersJSONData struct {
	TeamHTTPHeaders TeamHttpHeaders `json:"teamHttpHeaders"`
}

type TeamHttpHeaders map[string][]TeamHttpHeader

type TeamHttpHeader struct {
	Header string `json:"header"`
	Value  string `json:"value"`
}

func (m *TeamHTTPHeadersMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	err := m.setHeaders(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.QueryData(ctx, req)
}

func (m *TeamHTTPHeadersMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := m.setHeaders(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.next.CallResource(ctx, req, sender)
}

func (m *TeamHTTPHeadersMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	err := m.setHeaders(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.CheckHealth(ctx, req)
}

func (m *TeamHTTPHeadersMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *TeamHTTPHeadersMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *TeamHTTPHeadersMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *TeamHTTPHeadersMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

func (m *TeamHTTPHeadersMiddleware) setHeaders(ctx context.Context, pCtx backend.PluginContext, req interface{}) error {
	reqCtx := contexthandler.FromContext(ctx)
	// if request not for a datasource or no HTTP request context skip middleware
	if req == nil || pCtx.DataSourceInstanceSettings == nil || reqCtx == nil || reqCtx.Req == nil {
		return nil
	}

	settings := pCtx.DataSourceInstanceSettings
	jsonDataBytes, err := simplejson.NewJson(settings.JSONData)
	if err != nil {
		return err
	}

	ds := &datasources.DataSource{
		ID:       settings.ID,
		OrgID:    pCtx.OrgID,
		JsonData: jsonDataBytes,
		Updated:  settings.Updated,
	}

	// TODO: add teams to User struct in grafana-plugin-sdk-go@v0.179.0/backend/common.go
	// teams := pCtx.User.Teams
	teams := []int64{}
	teamHTTPHeaders, err := getTeamHTTPHeaders(ds, teams)
	if err != nil {
		return err
	}

	switch t := req.(type) {
	case *backend.QueryDataRequest:
		for key, value := range teamHTTPHeaders {
			t.SetHTTPHeader(key, value)
		}
	case *backend.CheckHealthRequest:
		for key, value := range teamHTTPHeaders {
			t.SetHTTPHeader(key, value)
		}
	case *backend.CallResourceRequest:
		for key, value := range teamHTTPHeaders {
			t.SetHTTPHeader(key, value)
		}
	}

	return nil
}

func getTeamHTTPHeaders(ds *datasources.DataSource, teams []int64) (map[string]string, error) {
	teamHTTPHeaders := make(map[string]string)
	teamHTTPHeadersJSON := TeamHTTPHeadersJSONData{}
	if ds.JsonData != nil {
		jsonData, err := ds.JsonData.MarshalJSON()
		if err != nil {
			return nil, err
		}
		err = json.Unmarshal(jsonData, &teamHTTPHeadersJSON)
		if err != nil {
			return nil, err
		}

		for teamID, headers := range teamHTTPHeadersJSON.TeamHTTPHeaders {
			id, err := strconv.ParseInt(teamID, 10, 64)
			if err != nil {
				// FIXME: logging here
				continue
			}
			if !contains(teams, id) {
				continue
			}

			for _, header := range headers {
				// TODO: handle multiple header values
				teamHTTPHeaders[header.Header] = header.Value
			}
		}
	}

	return teamHTTPHeaders, nil
}

func contains(slice []int64, value int64) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}

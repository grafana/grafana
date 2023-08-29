package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/auth/assertid"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
)

const grafanaIdHeaderName = "X-Grafana-Id"

// NewGrafanaIDMiddleware creates a new plugins.ClientMiddleware that will
// set OAuth token headers on outgoing plugins.Client requests if the
// datasource has enabled Forward Grafana ID.
func NewGrafanaIDMiddleware(signer assertid.Service) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &GrafanaIDMiddleware{
			signer: signer,
			next:   next,
		}
	})
}

type GrafanaIDMiddleware struct {
	signer assertid.Service
	next   plugins.Client
}

func (m *GrafanaIDMiddleware) applyToken(ctx context.Context, pCtx backend.PluginContext, req interface{}) error {
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

	if assertid.IsIDSignerEnabledForDatasource(ds) {
		requester := reqCtx.SignedInUser
		token, err := m.signer.ActiveUserAssertion(requester, reqCtx.Req)
		if err != nil {
			return err
		}

		switch t := req.(type) {
		case *backend.QueryDataRequest:
			t.SetHTTPHeader(grafanaIdHeaderName, token)
		case *backend.CheckHealthRequest:
			t.SetHTTPHeader(grafanaIdHeaderName, token)
		case *backend.CallResourceRequest:
			t.SetHTTPHeader(grafanaIdHeaderName, token)
		}
	}

	return nil
}

func (m *GrafanaIDMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.QueryData(ctx, req)
}

func (m *GrafanaIDMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return err
	}

	return m.next.CallResource(ctx, req, sender)
}

func (m *GrafanaIDMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	err := m.applyToken(ctx, req.PluginContext, req)
	if err != nil {
		return nil, err
	}

	return m.next.CheckHealth(ctx, req)
}

func (m *GrafanaIDMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *GrafanaIDMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *GrafanaIDMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *GrafanaIDMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

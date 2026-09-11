package clientmiddleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/stretchr/testify/require"
)

func TestTracingHeaderMiddlewareSourceAttribution(t *testing.T) {
	tests := []struct {
		name           string
		incomingSource string
		fromAlert      bool
		wantSource     string
	}{
		{name: "defaults to api", wantSource: query.GrafanaSourceAPI},
		{name: "dashboard", incomingSource: query.GrafanaSourceDashboard, wantSource: query.GrafanaSourceDashboard},
		{name: "explore", incomingSource: query.GrafanaSourceExplore, wantSource: query.GrafanaSourceExplore},
		{name: "alerting", incomingSource: query.GrafanaSourceAlerting, wantSource: query.GrafanaSourceAlerting},
		{name: "unknown source defaults to api", incomingSource: "unknown", wantSource: query.GrafanaSourceAPI},
		{name: "alerting overrides client source", incomingSource: query.GrafanaSourceDashboard, fromAlert: true, wantSource: query.GrafanaSourceAlerting},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := &backend.QueryDataRequest{Headers: map[string]string{}}
			if tc.incomingSource != "" {
				req.Headers[query.HeaderGrafanaSource] = tc.incomingSource
			}
			if tc.fromAlert {
				req.Headers[models.FromAlertHeaderName] = "true"
			}

			(&TracingHeaderMiddleware{}).applyHeaders(context.Background(), req)

			require.Equal(t, tc.wantSource, req.GetHTTPHeader(query.HeaderGrafanaSource))
		})
	}
}

func TestTracingHeaderMiddlewareSourceAttributionFromHTTPContext(t *testing.T) {
	tests := []struct {
		name           string
		incomingSource string
		fromAlert      bool
		wantSource     string
	}{
		{name: "dashboard", incomingSource: query.GrafanaSourceDashboard, wantSource: query.GrafanaSourceDashboard},
		{name: "explore", incomingSource: query.GrafanaSourceExplore, wantSource: query.GrafanaSourceExplore},
		{name: "alerting", incomingSource: query.GrafanaSourceAlerting, wantSource: query.GrafanaSourceAlerting},
		{name: "alerting overrides client source", incomingSource: query.GrafanaSourceDashboard, fromAlert: true, wantSource: query.GrafanaSourceAlerting},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := &backend.QueryDataRequest{Headers: map[string]string{}}
			httpReq, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
			require.NoError(t, err)
			if tc.incomingSource != "" {
				httpReq.Header.Set(query.HeaderGrafanaSource, tc.incomingSource)
			}
			if tc.fromAlert {
				httpReq.Header.Set(models.FromAlertHeaderName, "true")
			}

			(&TracingHeaderMiddleware{}).applyHeaders(WithReqContext(httpReq, nil), req)

			require.Equal(t, tc.wantSource, req.GetHTTPHeader(query.HeaderGrafanaSource))
		})
	}
}

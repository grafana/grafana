package loganalytics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/require"
)

// recordingRoundTripper captures outbound requests so tests can assert the
// correlation API never leaves the configured Azure Monitor host.
type recordingRoundTripper struct {
	mu       sync.Mutex
	requests []*http.Request
	body     []byte
}

func (r *recordingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	r.mu.Lock()
	cloned := req.Clone(req.Context())
	if req.Body != nil {
		body, _ := io.ReadAll(req.Body)
		_ = req.Body.Close()
		req.Body = io.NopCloser(bytes.NewReader(body))
		cloned.Body = io.NopCloser(bytes.NewReader(body))
	}
	r.requests = append(r.requests, cloned)
	payload := r.body
	r.mu.Unlock()

	if payload == nil {
		payload = []byte(`{"properties":{"resources":[]}}`)
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(payload)),
		Request:    req,
	}, nil
}

func (r *recordingRoundTripper) snapshot() []*http.Request {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]*http.Request, len(r.requests))
	copy(out, r.requests)
	return out
}

func correlationSuccessBody(t *testing.T, resourceID string) []byte {
	t.Helper()
	body, err := json.Marshal(AzureCorrelationAPIResponse{
		ID:   resourceID,
		Name: "guid-1",
		Type: "microsoft.insights/transactions",
		Properties: AzureCorrelationAPIResponseProperties{
			Resources: []string{resourceID},
		},
	})
	require.NoError(t, err)
	return body
}

func tracesQueryWithResourceAndOperation(resource, operationID string) backend.DataQuery {
	fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
	return backend.DataQuery{
		JSON: fmt.Appendf(nil, `{
			"queryType": "Azure Traces",
			"azureTraces": {
				"resources": [%q],
				"resultFormat": %q,
				"traceTypes": ["trace"],
				"operationId": %q
			}
		}`, resource, dataquery.ResultFormatTable, operationID),
		RefID:     "A",
		TimeRange: backend.TimeRange{From: fromStart, To: fromStart.Add(34 * time.Minute)},
		QueryType: string(dataquery.AzureQueryTypeAzureTraces),
	}
}

func TestBuildAppInsightsQuery_RejectsResourceHostHijack(t *testing.T) {
	const azureMonitorHost = "management.azure.com"
	const azureMonitorURL = "https://" + azureMonitorHost
	const validResource = "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"

	appInsightsRegExp, err := regexp.Compile("(?i)providers/microsoft.insights/components")
	require.NoError(t, err)

	tests := []struct {
		name     string
		resource string
	}{
		{
			name:     "userinfo host hijack via @",
			resource: "@evil.tld" + validResource,
		},
		{
			name:     "suffix host hijack via leading dot",
			resource: ".evil.tld" + validResource,
		},
		{
			name:     "absolute URL resource",
			resource: "https://evil.tld" + validResource,
		},
		{
			name:     "scheme-relative resource",
			resource: "//evil.tld" + validResource,
		},
		{
			name:     "missing leading slash",
			resource: "subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transport := &recordingRoundTripper{
				body: correlationSuccessBody(t, validResource),
			}
			dsInfo := types.DatasourceInfo{
				Services: map[string]types.DatasourceService{
					"Azure Monitor": {
						URL:        azureMonitorURL,
						HTTPClient: &http.Client{Transport: transport},
					},
				},
			}

			query, err := buildAppInsightsQuery(
				context.Background(),
				tracesQueryWithResourceAndOperation(tt.resource, "test-op-id"),
				dsInfo,
				appInsightsRegExp,
				log.NewNullLogger(),
			)

			reqs := transport.snapshot()
			for _, req := range reqs {
				require.Equal(t, azureMonitorHost, req.URL.Hostname(), "must not send the Azure token to a hijacked host")
			}
			require.Error(t, err, "malicious resource must be rejected")
			require.True(t, backend.IsDownstreamError(err), "a rejected resource is invalid query input")
			require.Nil(t, query)
			require.Empty(t, reqs, "correlation API must not be called for a malicious resource")
		})
	}
}

func TestBuildAppInsightsQuery_CorrelationRequestStaysOnAzureMonitorHost(t *testing.T) {
	const azureMonitorHost = "management.azure.com"
	const azureMonitorURL = "https://" + azureMonitorHost
	const validResource = "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"

	appInsightsRegExp, err := regexp.Compile("(?i)providers/microsoft.insights/components")
	require.NoError(t, err)

	transport := &recordingRoundTripper{
		body: correlationSuccessBody(t, validResource),
	}
	dsInfo := types.DatasourceInfo{
		Services: map[string]types.DatasourceService{
			"Azure Monitor": {
				URL:        azureMonitorURL,
				HTTPClient: &http.Client{Transport: transport},
			},
		},
	}

	query, err := buildAppInsightsQuery(
		context.Background(),
		tracesQueryWithResourceAndOperation(validResource, "test-op-id"),
		dsInfo,
		appInsightsRegExp,
		log.NewNullLogger(),
	)
	require.NoError(t, err)
	require.NotNil(t, query)

	reqs := transport.snapshot()
	require.NotEmpty(t, reqs, "expected a correlation API request for a valid resource")
	for _, req := range reqs {
		require.Equal(t, azureMonitorHost, req.URL.Hostname(), "correlation request host must remain the configured Azure Monitor host")
		require.Nil(t, req.URL.User, "correlation request must not carry userinfo derived from the resource")
		require.Contains(t, req.URL.EscapedPath(), validResource)
		require.Contains(t, req.URL.EscapedPath(), "/providers/microsoft.insights/transactions/test-op-id")
	}
}

func TestBuildAppInsightsQuery_AllowsOperationIdContainingDots(t *testing.T) {
	const azureMonitorHost = "management.azure.com"
	const azureMonitorURL = "https://" + azureMonitorHost
	const validResource = "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"
	const operationID = "foo..bar"

	appInsightsRegExp, err := regexp.Compile("(?i)providers/microsoft.insights/components")
	require.NoError(t, err)

	transport := &recordingRoundTripper{
		body: correlationSuccessBody(t, validResource),
	}
	dsInfo := types.DatasourceInfo{
		Services: map[string]types.DatasourceService{
			"Azure Monitor": {
				URL:        azureMonitorURL,
				HTTPClient: &http.Client{Transport: transport},
			},
		},
	}

	query, err := buildAppInsightsQuery(
		context.Background(),
		tracesQueryWithResourceAndOperation(validResource, operationID),
		dsInfo,
		appInsightsRegExp,
		log.NewNullLogger(),
	)
	require.NoError(t, err)
	require.NotNil(t, query)

	reqs := transport.snapshot()
	require.NotEmpty(t, reqs)
	for _, req := range reqs {
		require.Equal(t, azureMonitorHost, req.URL.Hostname())
		require.Contains(t, req.URL.EscapedPath(), "/providers/microsoft.insights/transactions/"+operationID)
	}
}

func TestBuildAppInsightsQuery_RejectsOperationIdPathInjection(t *testing.T) {
	const azureMonitorHost = "management.azure.com"
	const azureMonitorURL = "https://" + azureMonitorHost
	const validResource = "/subscriptions/test-sub/resourceGroups/test-rg/providers/Microsoft.Insights/components/r1"

	appInsightsRegExp, err := regexp.Compile("(?i)providers/microsoft.insights/components")
	require.NoError(t, err)

	tests := []struct {
		name        string
		operationID string
	}{
		{
			name:        "path traversal segments",
			operationID: "../subscriptions/other",
		},
		{
			name:        "query string injection",
			operationID: "op-id?api-version=attacker",
		},
		{
			name:        "fragment injection",
			operationID: "op-id#attacker",
		},
		{
			name:        "slash escapes transaction segment",
			operationID: "op/extra",
		},
		{
			name:        "single quote breaks the KQL string",
			operationID: "op'or'op",
		},
		{
			name:        "double quote breaks the KQL string",
			operationID: `op"or"op`,
		},
		{
			name:        "longer than the telemetry schema limit",
			operationID: strings.Repeat("a", 129),
		},
		{
			name:        "dot segment is cleaned out of the path",
			operationID: ".",
		},
		{
			name:        "dotdot segment drops the transactions element",
			operationID: "..",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transport := &recordingRoundTripper{
				body: correlationSuccessBody(t, validResource),
			}
			dsInfo := types.DatasourceInfo{
				Services: map[string]types.DatasourceService{
					"Azure Monitor": {
						URL:        azureMonitorURL,
						HTTPClient: &http.Client{Transport: transport},
					},
				},
			}

			query, err := buildAppInsightsQuery(
				context.Background(),
				tracesQueryWithResourceAndOperation(validResource, tt.operationID),
				dsInfo,
				appInsightsRegExp,
				log.NewNullLogger(),
			)

			require.Error(t, err, "unsafe operationId must be rejected")
			require.True(t, backend.IsDownstreamError(err), "a rejected operation ID is invalid query input")
			require.Nil(t, query)
			require.Empty(t, transport.snapshot(), "correlation API must not be called for an unsafe operationId")
		})
	}
}

package query

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	queryapi "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const (
	singlePromQuery = `{
		"queries": [{"datasource": {"type": "prometheus", "uid": "demo-prom"}, "expr": "1", "refId": "A"}],
		"from": "now-1h",
		"to": "now"
	}`
	twoPromQueries = `{
		"queries": [
			{"datasource": {"type": "prometheus", "uid": "demo-prom"}, "expr": "1", "refId": "A"},
			{"datasource": {"type": "prometheus", "uid": "demo-prom"}, "expr": "2", "refId": "B"}
		],
		"from": "now-1h",
		"to": "now"
	}`
	// deliberately not formatted the way encoding/json would write it, so a byte comparison proves it was not re-encoded
	rawProxyBody = `{"results":{"A":{"status":200,  "frames":[]}}}`
)

func setRawResponseProxyFlag(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagDatasourcesQueryServiceRawResponseProxy: {
			Key:            featuremgmt.FlagDatasourcesQueryServiceRawResponseProxy,
			DefaultVariant: variant,
			Variants:       map[string]any{"enabled": true, "disabled": false},
		},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

type rawProxyResult struct {
	statusCode     int
	body           string
	header         http.Header
	reportedStatus int
}

func runRawProxyQuery(t *testing.T, raw *mockRawResponse, queryJSON string, headers map[string]string) rawProxyResult {
	t.Helper()
	reported := 0
	builder := &QueryAPIBuilder{
		converter: &expr.ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.InitializeTracerForTest(),
		},
		instanceProvider: mockInstanceProvider{
			stubbedFrame: data.NewFrame("", data.NewField("Value", nil, []float64{1})),
			raw:          raw,
		},
		tracer:                 tracing.InitializeTracerForTest(),
		log:                    log.New("test"),
		legacyDatasourceLookup: &mockLegacyDataSourceLookup{},
		reportStatus:           func(_ context.Context, code int) { reported = code },
	}

	reqCtx := claims.WithAuthInfo(identity.WithRequester(context.Background(), mockUser{}), &mockAuthInfo{})
	req := httptest.NewRequestWithContext(reqCtx, http.MethodPost, "/some-path", strings.NewReader(queryJSON))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	rr := httptest.NewRecorder()
	builder.QueryDatasources(rr, req)
	result := rr.Result()
	defer func() { _ = result.Body.Close() }()
	body, err := io.ReadAll(result.Body)
	require.NoError(t, err)

	return rawProxyResult{statusCode: result.StatusCode, body: string(body), header: result.Header, reportedStatus: reported}
}

func TestQueryDatasourcesRawResponseProxy(t *testing.T) {
	okRaw := &mockRawResponse{statusCode: http.StatusOK, body: rawProxyBody}

	t.Run("forwards the datasource body unchanged for a single query", func(t *testing.T) {
		setRawResponseProxyFlag(t, true)
		res := runRawProxyQuery(t, okRaw, singlePromQuery, nil)

		require.Equal(t, http.StatusOK, res.statusCode)
		require.Equal(t, rawProxyBody, res.body)
		require.Equal(t, "1", res.header.Get("X-Ds-Querier-Raw"))
		require.Equal(t, "application/json", res.header.Get("Content-Type"))
		require.Equal(t, http.StatusOK, res.reportedStatus)
	})

	decodedPathCases := []struct {
		name      string
		enabled   bool
		queryJSON string
		headers   map[string]string
	}{
		{name: "flag disabled", enabled: false, queryJSON: singlePromQuery},
		{name: "more than one query", enabled: true, queryJSON: twoPromQueries},
		{name: "query from alerting", enabled: true, queryJSON: singlePromQuery, headers: map[string]string{"FromAlert": "true"}},
	}
	for _, tc := range decodedPathCases {
		t.Run("uses the decoded path when "+tc.name, func(t *testing.T) {
			setRawResponseProxyFlag(t, tc.enabled)
			res := runRawProxyQuery(t, okRaw, tc.queryJSON, tc.headers)

			require.Equal(t, http.StatusOK, res.statusCode)
			require.NotEqual(t, rawProxyBody, res.body)
			qdr := &queryapi.QueryDataResponse{}
			require.NoError(t, json.Unmarshal([]byte(res.body), qdr))
			require.Contains(t, qdr.Responses, "A")
			require.Len(t, qdr.Responses["A"].Frames, 1)
		})
	}

	t.Run("applies the downstream error rewrite to non-200 responses", func(t *testing.T) {
		setRawResponseProxyFlag(t, true)
		raw := &mockRawResponse{
			statusCode: http.StatusInternalServerError,
			body:       `{"results":{"A":{"status":500,"error":"bad query","errorSource":"downstream"}}}`,
		}
		res := runRawProxyQuery(t, raw, singlePromQuery, nil)

		require.Equal(t, http.StatusBadRequest, res.statusCode)
		require.Equal(t, http.StatusBadRequest, res.reportedStatus)
		qdr := &queryapi.QueryDataResponse{}
		require.NoError(t, json.Unmarshal([]byte(res.body), qdr))
		require.Equal(t, "bad query", qdr.Responses["A"].Error.Error())
	})
}

package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func withPaginationFlag(req *http.Request) *http.Request {
	cfg := config.NewGrafanaCfg(map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "azureMonitorServerSidePagination"})
	return req.WithContext(config.WithGrafanaConfig(req.Context(), cfg))
}

func newArmPagingServer(t *testing.T, totalPages, perPage int) (srv *httptest.Server, requestCount *int, seenTokens *[]string) {
	t.Helper()
	count := 0
	tokens := []string{}
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count++
		tok := r.URL.Query().Get("$skiptoken")
		tokens = append(tokens, tok)

		page := 1
		if tok != "" {
			p, err := strconv.Atoi(strings.TrimPrefix(tok, "page"))
			require.NoError(t, err)
			page = p
		}

		value := make([]map[string]string, 0, perPage)
		for i := 0; i < perPage; i++ {
			n := (page-1)*perPage + i + 1
			value = append(value, map[string]string{
				"subscriptionId": fmt.Sprintf("sub-%d", n),
				"displayName":    fmt.Sprintf("Sub %d", n),
			})
		}

		resp := map[string]any{"value": value}
		if page < totalPages {
			resp["nextLink"] = fmt.Sprintf("%s/subscriptions?api-version=2019-03-01&$skiptoken=page%d", srv.URL, page+1)
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	t.Cleanup(srv.Close)
	return srv, &count, &tokens
}

func newPaginationTestService(serverURL string, client *http.Client) *Service {
	return &Service{
		im: &fakeInstance{
			services: map[string]types.DatasourceService{
				azureMonitor: {
					URL:        serverURL,
					HTTPClient: client,
					Logger:     log.DefaultLogger,
				},
			},
		},
		logger: log.DefaultLogger,
	}
}

func decodeSubscriptionIDs(t *testing.T, body []byte) []string {
	t.Helper()
	var parsed struct {
		Value []struct {
			SubscriptionID string `json:"subscriptionId"`
		} `json:"value"`
	}
	require.NoError(t, json.Unmarshal(body, &parsed))
	ids := make([]string, 0, len(parsed.Value))
	for _, v := range parsed.Value {
		ids = append(ids, v.SubscriptionID)
	}
	return ids
}

func TestHandleSubscriptions(t *testing.T) {
	const path = "http://foo/azuremonitor/subscriptions?api-version=2019-03-01"

	t.Run("single page returns all items with no cursor", func(t *testing.T) {
		srv, count, _ := newArmPagingServer(t, 1, 3)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path, nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		res := rw.Result()
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, 1, *count)
		require.Empty(t, res.Header.Get("Link"))
		require.Empty(t, res.Header.Get("X-Results-Truncated"))

		body, err := readAllClose(res)
		require.NoError(t, err)
		require.Equal(t, []string{"sub-1", "sub-2", "sub-3"}, decodeSubscriptionIDs(t, body))
	})

	t.Run("eager mode aggregates every page in order", func(t *testing.T) {
		srv, count, _ := newArmPagingServer(t, 3, 2)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path+"&listAll=true", nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		res := rw.Result()
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, 3, *count)
		require.Empty(t, res.Header.Get("Link"))

		body, err := readAllClose(res)
		require.NoError(t, err)
		require.Equal(t,
			[]string{"sub-1", "sub-2", "sub-3", "sub-4", "sub-5", "sub-6"},
			decodeSubscriptionIDs(t, body),
		)
	})

	t.Run("on-demand mode returns a single page plus a Link cursor", func(t *testing.T) {
		srv, count, _ := newArmPagingServer(t, 3, 2)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path+"&listAll=false", nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		res := rw.Result()
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, 1, *count)

		link := res.Header.Get("Link")
		require.Contains(t, link, `rel="next"`)
		require.Contains(t, link, "nextToken=page2")
		require.Contains(t, link, "listAll=false")

		body, err := readAllClose(res)
		require.NoError(t, err)
		require.Equal(t, []string{"sub-1", "sub-2"}, decodeSubscriptionIDs(t, body))
	})

	t.Run("on-demand mode re-injects the continuation token without leaking control params", func(t *testing.T) {
		var seenQuery url.Values
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			seenQuery = r.URL.Query()
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"value":[{"subscriptionId":"sub-3"},{"subscriptionId":"sub-4"}]}`))
		}))
		t.Cleanup(srv.Close)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path+"&listAll=false&nextToken=page2", nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		res := rw.Result()
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, "page2", seenQuery.Get("$skiptoken"))
		require.Empty(t, seenQuery.Get("listAll"))
		require.Empty(t, seenQuery.Get("nextToken"))
		require.Equal(t, "2019-03-01", seenQuery.Get("api-version"))

		body, err := readAllClose(res)
		require.NoError(t, err)
		require.Equal(t, []string{"sub-3", "sub-4"}, decodeSubscriptionIDs(t, body))
	})

	t.Run("eager mode stops at the page cap and flags truncation", func(t *testing.T) {
		srv, count, _ := newArmPagingServer(t, MaxArmPages+10, 1)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path+"&listAll=true", nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		res := rw.Result()
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, MaxArmPages, *count)
		require.Equal(t, "true", res.Header.Get("X-Results-Truncated"))

		link := res.Header.Get("Link")
		require.Contains(t, link, `rel="next"`)
		require.Contains(t, link, "listAll=true")

		body, err := readAllClose(res)
		require.NoError(t, err)
		require.Len(t, decodeSubscriptionIDs(t, body), MaxArmPages)
	})

	t.Run("ARM error propagates the downstream status", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", http.StatusBadGateway)
		}))
		t.Cleanup(srv.Close)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path, nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		require.Equal(t, http.StatusBadGateway, rw.Result().StatusCode)
	})

	t.Run("flag off proxies the request verbatim without pagination", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"value":[{"subscriptionId":"sub-1"}],"nextLink":"https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=page2"}`))
		}))
		t.Cleanup(srv.Close)
		s := &Service{
			im: &fakeInstance{
				services: map[string]types.DatasourceService{
					azureMonitor: {
						URL:        srv.URL,
						HTTPClient: srv.Client(),
						Logger:     log.DefaultLogger,
					},
				},
			},
			executors: map[string]azDatasourceExecutor{
				azureMonitor: &metrics.AzureMonitorDatasource{
					Proxy: &httpServiceProxy{logger: log.DefaultLogger},
				},
			},
			logger: log.DefaultLogger,
		}

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, path, nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, req)

		res := rw.Result()
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Empty(t, res.Header.Get("Link"))

		body, err := readAllClose(res)
		require.NoError(t, err)
		require.Contains(t, string(body), "nextLink")
	})
}

func TestHandleWorkspaces(t *testing.T) {
	t.Run("targets the workspaces path for the subscription", func(t *testing.T) {
		var requestedPath string
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestedPath = r.URL.Path
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"value":[{"id":"ws-1","name":"Workspace 1"}]}`))
		}))
		t.Cleanup(srv.Close)
		s := newPaginationTestService(srv.URL, srv.Client())

		rw := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, "http://foo/azuremonitor/subscriptions/sub-42/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview", nil)
		require.NoError(t, err)
		s.handleResourceReq(azureMonitor)(rw, withPaginationFlag(req))

		require.Equal(t, http.StatusOK, rw.Result().StatusCode)
		require.Equal(t, "/subscriptions/sub-42/providers/Microsoft.OperationalInsights/workspaces", requestedPath)
	})
}

func TestSkipTokenFromNextLink(t *testing.T) {
	tests := []struct {
		name     string
		nextLink string
		expected string
	}{
		{"empty", "", ""},
		{"skiptoken lowercase", "https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=abc123", "abc123"},
		{"skipToken camelCase", "https://management.azure.com/subscriptions?$skipToken=XYZ", "XYZ"},
		{"no token", "https://management.azure.com/subscriptions?api-version=2019-03-01", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, skipTokenFromNextLink(tt.nextLink))
		})
	}
}

func TestAppendSkipToken(t *testing.T) {
	out := appendSkipToken("https://management.azure.com/subscriptions?api-version=2019-03-01", "page2")
	require.Contains(t, out, "api-version=2019-03-01")
	require.Contains(t, out, "$skiptoken=page2")
	require.NotContains(t, out, "%24skiptoken")
	require.Equal(t, "page2", skipTokenFromNextLink(out))
}

func TestRebaseNextLink(t *testing.T) {
	got := rebaseNextLink(
		"https://proxy.internal/subscriptions?api-version=2019-03-01",
		"https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=abc",
	)
	require.Equal(t, "https://proxy.internal/subscriptions?api-version=2019-03-01&$skiptoken=abc", got)
	require.Equal(t, "", rebaseNextLink("https://proxy.internal/x", ""))

	withPrefix := rebaseNextLink(
		"https://proxy.internal/api/datasources/proxy/42/subscriptions?api-version=2019-03-01",
		"https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=abc",
	)
	require.Equal(t, "https://proxy.internal/api/datasources/proxy/42/subscriptions?api-version=2019-03-01&$skiptoken=abc", withPrefix)
}

func TestFetchArmPagesRebasesNextLinkHost(t *testing.T) {
	var srv *httptest.Server
	count := 0
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count++
		page := 1
		if tok := r.URL.Query().Get("$skiptoken"); tok == "page2" {
			page = 2
		}
		resp := map[string]any{"value": []map[string]string{{"subscriptionId": fmt.Sprintf("sub-%d", page)}}}
		if page < 2 {
			resp["nextLink"] = "https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=page2"
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	}))
	t.Cleanup(srv.Close)

	value, _, truncated, err := fetchArmPages(context.Background(), srv.Client(), srv.URL+"/subscriptions?api-version=2019-03-01", true, MaxArmPages)
	require.NoError(t, err)
	require.False(t, truncated)
	require.Len(t, value, 2)
	require.Equal(t, 2, count)
}

func TestFetchArmPagesTruncation(t *testing.T) {
	srv, count, _ := newArmPagingServer(t, 100, 1)
	value, nextToken, truncated, err := fetchArmPages(context.Background(), srv.Client(), srv.URL+"/subscriptions?api-version=2019-03-01", true, 3)
	require.NoError(t, err)
	require.True(t, truncated)
	require.Len(t, value, 3)
	require.Equal(t, 3, *count)
	require.NotEmpty(t, nextToken)
	require.Equal(t, "page4", nextToken)
}

func readAllClose(res *http.Response) ([]byte, error) {
	defer func() { _ = res.Body.Close() }()
	return io.ReadAll(res.Body)
}

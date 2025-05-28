package prometheus

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPrometheus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	ctx := context.Background()

	var outgoingRequest *http.Request
	outgoingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		outgoingRequest = r
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(outgoingServer.Close)

	jsonData := simplejson.NewFromAny(map[string]any{
		"httpMethod":            "post",
		"httpHeaderName1":       "X-CUSTOM-HEADER",
		"customQueryParameters": "q1=1&q2=2",
	})
	secureJSONData := map[string]string{
		"basicAuthPassword": "basicAuthPassword",
		"httpHeaderValue1":  "custom-header-value",
	}

	uid := "prometheus"
	_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID:          1,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "Prometheus",
		Type:           datasources.DS_PROMETHEUS,
		UID:            uid,
		URL:            outgoingServer.URL,
		BasicAuth:      true,
		BasicAuthUser:  "basicAuthUser",
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	})
	require.NoError(t, err)

	t.Run("When calling /api/ds/query should set expected headers on outgoing HTTP request", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]any{
			"datasource": map[string]any{
				"uid": uid,
			},
			"expr":         "1",
			"instantQuery": true,
		})
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.MetricRequest{
			From:    "1668078080000",
			To:      "1668081680000",
			Queries: []*simplejson.Json{query},
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", grafanaListeningAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = resp.Body.Close()
		})

		require.NotNil(t, outgoingRequest)
		require.Equal(t, "/api/v1/query_range?q1=1&q2=2", outgoingRequest.URL.String())
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})

	t.Run("When calling /api/ds/query should set expected headers on outgoing HTTP request", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]any{
			"datasource": map[string]any{
				"uid": uid,
			},
			"expr":         "up",
			"instantQuery": true,
		})
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.MetricRequest{
			From:    "now-1h",
			To:      "now",
			Queries: []*simplejson.Json{query},
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", grafanaListeningAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = resp.Body.Close()
		})

		require.NotNil(t, outgoingRequest)
		require.Equal(t, "/api/v1/query_range", outgoingRequest.URL.Path)
		require.Contains(t, outgoingRequest.URL.String(), "?q1=1&q2=2")
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})
}

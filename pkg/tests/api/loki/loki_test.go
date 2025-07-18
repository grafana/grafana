package loki

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

func TestIntegrationLoki(t *testing.T) {
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

	jsonData := simplejson.NewFromAny(map[string]interface{}{
		"httpMethod":      "post",
		"httpHeaderName1": "X-CUSTOM-HEADER",
	})
	secureJSONData := map[string]string{
		"basicAuthPassword": "basicAuthPassword",
		"httpHeaderValue1":  "custom-header-value",
	}

	uid := "loki"
	_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID:          1,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "Loki",
		Type:           datasources.DS_LOKI,
		UID:            uid,
		URL:            outgoingServer.URL,
		BasicAuth:      true,
		BasicAuthUser:  "basicAuthUser",
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	})
	require.NoError(t, err)

	t.Run("When calling /api/ds/query should set expected headers on outgoing HTTP request", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid": uid,
			},
			"expr": "{job=\"grafana\"}",
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
		req, err := http.NewRequest("POST", u, buf1)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Unspported-Header", "uh")
		req.Header.Set("Fromalert", "true")
		req.Header.Set("X-Rule-Name", "n1")
		req.Header.Set("X-Rule-Uid", "u1")
		req.Header.Set("X-Rule-Folder", "f1")
		req.Header.Set("X-Rule-Source", "s1")
		req.Header.Set("X-Rule-Type", "t1")
		req.Header.Set("X-Rule-Version", "v1")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		require.NotNil(t, outgoingRequest)
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
		require.Equal(t, "", outgoingRequest.Header.Get("X-Unspported-Header"))
		require.Equal(t, "true", outgoingRequest.Header.Get("Fromalert"))
		require.Equal(t, "n1", outgoingRequest.Header.Get("X-Rule-Name"))
		require.Equal(t, "u1", outgoingRequest.Header.Get("X-Rule-Uid"))
		require.Equal(t, "f1", outgoingRequest.Header.Get("X-Rule-Folder"))
		require.Equal(t, "s1", outgoingRequest.Header.Get("X-Rule-Source"))
		require.Equal(t, "t1", outgoingRequest.Header.Get("X-Rule-Type"))
		require.Equal(t, "v1", outgoingRequest.Header.Get("X-Rule-Version"))
	})

	t.Run("should forward `X-Dashboard-Title` header but no `X-Panel-Title`", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid": uid,
			},
			"expr": "{job=\"grafana\"}",
		})
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.MetricRequest{
			From:    "now-1h",
			To:      "now",
			Queries: []*simplejson.Json{query},
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", grafanaListeningAddr)
		req, err := http.NewRequest("POST", u, buf1)
		if err != nil {
			require.NoError(t, err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Dashboard-Title", "My Dashboard Title")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		require.NotNil(t, outgoingRequest)
		require.Equal(t, "My Dashboard Title", outgoingRequest.Header.Get("X-Dashboard-Title"))
		require.Equal(t, "", outgoingRequest.Header.Get("X-Panel-Title"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})

	t.Run("should forward `X-Dashboard-Title` and `X-Panel-Title` header", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"datasource": map[string]interface{}{
				"uid": uid,
			},
			"expr": "{job=\"grafana\"}",
		})
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.MetricRequest{
			From:    "now-1h",
			To:      "now",
			Queries: []*simplejson.Json{query},
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", grafanaListeningAddr)
		req, err := http.NewRequest("POST", u, buf1)
		if err != nil {
			require.NoError(t, err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Dashboard-Title", "My Dashboard Title")
		req.Header.Set("X-Panel-Title", "My Panel Title")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		require.NotNil(t, outgoingRequest)
		require.Equal(t, "My Dashboard Title", outgoingRequest.Header.Get("X-Dashboard-Title"))
		require.Equal(t, "My Panel Title", outgoingRequest.Header.Get("X-Panel-Title"))
		username, pwd, ok := outgoingRequest.BasicAuth()
		require.True(t, ok)
		require.Equal(t, "basicAuthUser", username)
		require.Equal(t, "basicAuthPassword", pwd)
	})
}

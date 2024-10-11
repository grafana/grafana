package opentdsb

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/hashicorp/go-retryablehttp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationOpenTSDB(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	ctx := context.Background()

	// Increase timeout and add retry mechanism
	err := retry(5, 2*time.Second, func() error {
		return waitForGrafanaToBeReady(grafanaListeningAddr)
	})
	require.NoError(t, err, "Grafana failed to start")

	u := testinfra.CreateUser(t, testEnv.SQLStore, testEnv.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	var outgoingRequest *http.Request
	outgoingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		outgoingRequest = r
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(outgoingServer.Close)

	jsonData := simplejson.NewFromAny(map[string]any{
		"httpMethod":      "post",
		"httpHeaderName1": "X-CUSTOM-HEADER",
	})
	secureJSONData := map[string]string{
		"basicAuthPassword": "basicAuthPassword",
		"httpHeaderValue1":  "custom-header-value",
	}

	uid := "influxdb"
	_, err = testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID:          u.OrgID,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "opentsdb",
		Type:           datasources.DS_OPENTSDB,
		UID:            uid,
		URL:            outgoingServer.URL,
		BasicAuth:      true,
		BasicAuthUser:  "basicAuthUser",
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	})
	require.NoError(t, err)

	t.Run("When calling query should set expected headers on outgoing HTTP request", func(t *testing.T) {
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
		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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
	})
}

func waitForGrafanaToBeReady(addr string) error {
	client := retryablehttp.NewClient()
	client.RetryMax = 5
	client.RetryWaitMin = 5 * time.Second
	client.RetryWaitMax = 30 * time.Second

	url := fmt.Sprintf("http://%s/api/health", addr)
	req, err := retryablehttp.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}

// Add this helper function at the end of the file
func retry(attempts int, sleep time.Duration, f func() error) (err error) {
	for i := 0; i < attempts; i++ {
		if i > 0 {
			time.Sleep(sleep)
			sleep *= 2 // exponential backoff
		}
		err = f()
		if err == nil {
			return nil
		}
	}
	return fmt.Errorf("after %d attempts, last error: %s", attempts, err)
}

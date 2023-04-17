package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"github.com/weaveworks/common/http/client"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestLokiConfig(t *testing.T) {
	t.Run("test URL options", func(t *testing.T) {
		type testCase struct {
			name     string
			in       setting.UnifiedAlertingStateHistorySettings
			expRead  string
			expWrite string
			expErr   string
		}

		cases := []testCase{
			{
				name: "remote url only",
				in: setting.UnifiedAlertingStateHistorySettings{
					LokiRemoteURL: "http://url.com",
				},
				expRead:  "http://url.com",
				expWrite: "http://url.com",
			},
			{
				name: "separate urls",
				in: setting.UnifiedAlertingStateHistorySettings{
					LokiReadURL:  "http://read.url.com",
					LokiWriteURL: "http://write.url.com",
				},
				expRead:  "http://read.url.com",
				expWrite: "http://write.url.com",
			},
			{
				name: "single fallback",
				in: setting.UnifiedAlertingStateHistorySettings{
					LokiRemoteURL: "http://url.com",
					LokiReadURL:   "http://read.url.com",
				},
				expRead:  "http://read.url.com",
				expWrite: "http://url.com",
			},
			{
				name: "invalid",
				in: setting.UnifiedAlertingStateHistorySettings{
					LokiRemoteURL: "://://",
				},
				expErr: "failed to parse",
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				res, err := NewLokiConfig(tc.in)
				if tc.expErr != "" {
					require.ErrorContains(t, err, tc.expErr)
				} else {
					require.Equal(t, tc.expRead, res.ReadPathURL.String())
					require.Equal(t, tc.expWrite, res.WritePathURL.String())
				}
			})
		}
	})

	t.Run("captures external labels", func(t *testing.T) {
		set := setting.UnifiedAlertingStateHistorySettings{
			LokiRemoteURL:  "http://url.com",
			ExternalLabels: map[string]string{"a": "b"},
		}

		res, err := NewLokiConfig(set)

		require.NoError(t, err)
		require.Contains(t, res.ExternalLabels, "a")
	})
}

func TestLokiHTTPClient(t *testing.T) {
	t.Run("push formats expected data", func(t *testing.T) {
		req := NewFakeRequester()
		client := createTestLokiClient(req)
		now := time.Now().UTC()
		data := []stream{
			{
				Stream: map[string]string{},
				Values: []sample{
					{
						T: now,
						V: "some line",
					},
				},
			},
		}

		err := client.push(context.Background(), data)

		require.NoError(t, err)
		require.Contains(t, "/loki/api/v1/push", req.lastRequest.URL.Path)
		sent := reqBody(t, req.lastRequest)
		exp := fmt.Sprintf(`{"streams": [{"stream": {}, "values": [["%d", "some line"]]}]}`, now.UnixNano())
		require.JSONEq(t, exp, sent)
	})
}

// This function can be used for local testing, just remove the skip call.
func TestLokiHTTPClient_Manual(t *testing.T) {
	t.Skip()

	t.Run("smoke test pinging Loki", func(t *testing.T) {
		url, err := url.Parse("https://logs-prod-eu-west-0.grafana.net")
		require.NoError(t, err)

		client := newLokiClient(LokiConfig{
			ReadPathURL:  url,
			WritePathURL: url,
			Encoder:      JsonEncoder{},
		}, NewRequester(), metrics.NewHistorianMetrics(prometheus.NewRegistry()), log.NewNopLogger())

		// Unauthorized request should fail against Grafana Cloud.
		err = client.ping(context.Background())
		require.Error(t, err)

		client.cfg.BasicAuthUser = "<your_username>"
		client.cfg.BasicAuthPassword = "<your_password>"

		// When running on prem, you might need to set the tenant id,
		// so the x-scope-orgid header is set.
		// client.cfg.TenantID = "<your_tenant_id>"

		// Authorized request should not fail against Grafana Cloud.
		err = client.ping(context.Background())
		require.NoError(t, err)
	})

	t.Run("smoke test range querying Loki", func(t *testing.T) {
		url, err := url.Parse("https://logs-prod-eu-west-0.grafana.net")
		require.NoError(t, err)

		client := newLokiClient(LokiConfig{
			ReadPathURL:       url,
			WritePathURL:      url,
			BasicAuthUser:     "<your_username>",
			BasicAuthPassword: "<your_password>",
			Encoder:           JsonEncoder{},
		}, NewRequester(), metrics.NewHistorianMetrics(prometheus.NewRegistry()), log.NewNopLogger())

		// When running on prem, you might need to set the tenant id,
		// so the x-scope-orgid header is set.
		// client.cfg.TenantID = "<your_tenant_id>"

		logQL := `{probe="Paris"}`

		// Define the query time range
		start := time.Now().Add(-30 * time.Minute).UnixNano()
		end := time.Now().UnixNano()

		// Authorized request should not fail against Grafana Cloud.
		res, err := client.rangeQuery(context.Background(), logQL, start, end)
		require.NoError(t, err)
		require.NotNil(t, res)
	})
}

func TestRow(t *testing.T) {
	t.Run("marshal", func(t *testing.T) {
		row := sample{
			T: time.Unix(0, 1234),
			V: "some sample",
		}

		jsn, err := json.Marshal(&row)

		require.NoError(t, err)
		require.JSONEq(t, `["1234", "some sample"]`, string(jsn))
	})

	t.Run("unmarshal", func(t *testing.T) {
		jsn := []byte(`["1234", "some sample"]`)

		row := sample{}
		err := json.Unmarshal(jsn, &row)

		require.NoError(t, err)
		require.Equal(t, int64(1234), row.T.UnixNano())
		require.Equal(t, "some sample", row.V)
	})

	t.Run("unmarshal invalid", func(t *testing.T) {
		jsn := []byte(`{"key": "wrong shape"}`)

		row := sample{}
		err := json.Unmarshal(jsn, &row)

		require.ErrorContains(t, err, "failed to deserialize sample")
	})

	t.Run("unmarshal bad timestamp", func(t *testing.T) {
		jsn := []byte(`["not-unix-nano", "some sample"]`)

		row := sample{}
		err := json.Unmarshal(jsn, &row)

		require.ErrorContains(t, err, "timestamp in Loki sample")
	})
}

func TestStream(t *testing.T) {
	t.Run("marshal", func(t *testing.T) {
		stream := stream{
			Stream: map[string]string{"a": "b"},
			Values: []sample{
				{T: time.Unix(0, 1), V: "one"},
				{T: time.Unix(0, 2), V: "two"},
			},
		}

		jsn, err := json.Marshal(stream)

		require.NoError(t, err)
		require.JSONEq(
			t,
			`{"stream": {"a": "b"}, "values": [["1", "one"], ["2", "two"]]}`,
			string(jsn),
		)
	})
}

func createTestLokiClient(req client.Requester) *httpLokiClient {
	url, _ := url.Parse("http://some.url")
	cfg := LokiConfig{
		WritePathURL: url,
		ReadPathURL:  url,
		Encoder:      JsonEncoder{},
	}
	met := metrics.NewHistorianMetrics(prometheus.NewRegistry())
	return newLokiClient(cfg, req, met, log.NewNopLogger())
}

func reqBody(t *testing.T, req *http.Request) string {
	t.Helper()

	defer func() {
		_ = req.Body.Close()
	}()
	byt, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	return string(byt)
}

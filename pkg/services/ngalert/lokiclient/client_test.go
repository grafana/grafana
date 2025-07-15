package lokiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

const lokiClientSpanName = "testLokiClientSpanName"

func TestLokiConfig(t *testing.T) {
	t.Run("test URL options", func(t *testing.T) {
		type testCase struct {
			name     string
			in       setting.UnifiedAlertingLokiSettings
			expRead  string
			expWrite string
			expErr   string
		}

		cases := []testCase{
			{
				name: "remote url only",
				in: setting.UnifiedAlertingLokiSettings{
					LokiRemoteURL: "http://url.com",
				},
				expRead:  "http://url.com",
				expWrite: "http://url.com",
			},
			{
				name: "separate urls",
				in: setting.UnifiedAlertingLokiSettings{
					LokiReadURL:  "http://read.url.com",
					LokiWriteURL: "http://write.url.com",
				},
				expRead:  "http://read.url.com",
				expWrite: "http://write.url.com",
			},
			{
				name: "single fallback",
				in: setting.UnifiedAlertingLokiSettings{
					LokiRemoteURL: "http://url.com",
					LokiReadURL:   "http://read.url.com",
				},
				expRead:  "http://read.url.com",
				expWrite: "http://url.com",
			},
			{
				name: "missing read",
				in: setting.UnifiedAlertingLokiSettings{
					LokiWriteURL: "http://url.com",
				},
				expErr: "either read path URL or remote",
			},
			{
				name: "missing write",
				in: setting.UnifiedAlertingLokiSettings{
					LokiReadURL: "http://url.com",
				},
				expErr: "either write path URL or remote",
			},
			{
				name: "invalid",
				in: setting.UnifiedAlertingLokiSettings{
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
		set := setting.UnifiedAlertingLokiSettings{
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
		data := []Stream{
			{
				Stream: map[string]string{},
				Values: []Sample{
					{
						T: now,
						V: "some line",
					},
				},
			},
		}

		err := client.Push(context.Background(), data)

		require.NoError(t, err)
		require.Contains(t, "/loki/api/v1/push", req.LastRequest.URL.Path)
		sent := reqBody(t, req.LastRequest)
		exp := fmt.Sprintf(`{"streams": [{"stream": {}, "values": [["%d", "some line"]]}]}`, now.UnixNano())
		require.JSONEq(t, exp, sent)
	})

	t.Run("range query", func(t *testing.T) {
		t.Run("passes along page size", func(t *testing.T) {
			req := NewFakeRequester().WithResponse(&http.Response{
				Status:        "200 OK",
				StatusCode:    200,
				Body:          io.NopCloser(bytes.NewBufferString(`{}`)),
				ContentLength: int64(0),
				Header:        make(http.Header, 0),
			})
			client := createTestLokiClient(req)
			now := time.Now().UTC().UnixNano()
			q := `{from="state-history"}`

			_, err := client.RangeQuery(context.Background(), q, now-100, now, 1100)

			require.NoError(t, err)
			params := req.LastRequest.URL.Query()
			require.True(t, params.Has("limit"), "query params did not contain 'limit': %#v", params)
			require.Equal(t, fmt.Sprint(1100), params.Get("limit"))
		})

		t.Run("uses default page size if limit not provided", func(t *testing.T) {
			req := NewFakeRequester().WithResponse(&http.Response{
				Status:        "200 OK",
				StatusCode:    200,
				Body:          io.NopCloser(bytes.NewBufferString(`{}`)),
				ContentLength: int64(0),
				Header:        make(http.Header, 0),
			})
			client := createTestLokiClient(req)
			now := time.Now().UTC().UnixNano()
			q := `{from="state-history"}`

			_, err := client.RangeQuery(context.Background(), q, now-100, now, 0)

			require.NoError(t, err)
			params := req.LastRequest.URL.Query()
			require.True(t, params.Has("limit"), "query params did not contain 'limit': %#v", params)
			require.Equal(t, fmt.Sprint(defaultPageSize), params.Get("limit"))
		})

		t.Run("uses default page size if limit invalid", func(t *testing.T) {
			req := NewFakeRequester().WithResponse(&http.Response{
				Status:        "200 OK",
				StatusCode:    200,
				Body:          io.NopCloser(bytes.NewBufferString(`{}`)),
				ContentLength: int64(0),
				Header:        make(http.Header, 0),
			})
			client := createTestLokiClient(req)
			now := time.Now().UTC().UnixNano()
			q := `{from="state-history"}`

			_, err := client.RangeQuery(context.Background(), q, now-100, now, -100)

			require.NoError(t, err)
			params := req.LastRequest.URL.Query()
			require.True(t, params.Has("limit"), "query params did not contain 'limit': %#v", params)
			require.Equal(t, fmt.Sprint(defaultPageSize), params.Get("limit"))
		})

		t.Run("uses maximum page size if limit too big", func(t *testing.T) {
			req := NewFakeRequester().WithResponse(&http.Response{
				Status:        "200 OK",
				StatusCode:    200,
				Body:          io.NopCloser(bytes.NewBufferString(`{}`)),
				ContentLength: int64(0),
				Header:        make(http.Header, 0),
			})
			client := createTestLokiClient(req)
			now := time.Now().UTC().UnixNano()
			q := `{from="state-history"}`

			_, err := client.RangeQuery(context.Background(), q, now-100, now, maximumPageSize+1000)

			require.NoError(t, err)
			params := req.LastRequest.URL.Query()
			require.True(t, params.Has("limit"), "query params did not contain 'limit': %#v", params)
			require.Equal(t, fmt.Sprint(maximumPageSize), params.Get("limit"))
		})
	})
}

// This function can be used for local testing, just remove the skip call.
func TestLokiHTTPClient_Manual(t *testing.T) {
	t.Skip()

	t.Run("smoke test pinging Loki", func(t *testing.T) {
		url, err := url.Parse("https://logs-prod-eu-west-0.grafana.net")
		require.NoError(t, err)

		metrics := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		client := NewLokiClient(LokiConfig{
			ReadPathURL:  url,
			WritePathURL: url,
			Encoder:      JsonEncoder{},
		}, NewRequester(), metrics.BytesWritten, metrics.WriteDuration, log.NewNopLogger(), tracing.InitializeTracerForTest(), lokiClientSpanName)

		// Unauthorized request should fail against Grafana Cloud.
		err = client.Ping(context.Background())
		require.Error(t, err)

		client.cfg.BasicAuthUser = "<your_username>"
		client.cfg.BasicAuthPassword = "<your_password>"

		// When running on prem, you might need to set the tenant id,
		// so the x-scope-orgid header is set.
		// client.cfg.TenantID = "<your_tenant_id>"

		// Authorized request should not fail against Grafana Cloud.
		err = client.Ping(context.Background())
		require.NoError(t, err)
	})

	t.Run("smoke test range querying Loki", func(t *testing.T) {
		url, err := url.Parse("https://logs-prod-eu-west-0.grafana.net")
		require.NoError(t, err)

		metrics := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
		client := NewLokiClient(LokiConfig{
			ReadPathURL:       url,
			WritePathURL:      url,
			BasicAuthUser:     "<your_username>",
			BasicAuthPassword: "<your_password>",
			Encoder:           JsonEncoder{},
		}, NewRequester(), metrics.BytesWritten, metrics.WriteDuration, log.NewNopLogger(), tracing.InitializeTracerForTest(), lokiClientSpanName)

		// When running on prem, you might need to set the tenant id,
		// so the x-scope-orgid header is set.
		// client.cfg.TenantID = "<your_tenant_id>"

		logQL := `{probe="Paris"}`

		// Define the query time range
		start := time.Now().Add(-30 * time.Minute).UnixNano()
		end := time.Now().UnixNano()

		// Authorized request should not fail against Grafana Cloud.
		res, err := client.RangeQuery(context.Background(), logQL, start, end, defaultPageSize)
		require.NoError(t, err)
		require.NotNil(t, res)
	})
}

func TestRow(t *testing.T) {
	t.Run("marshal", func(t *testing.T) {
		row := Sample{
			T: time.Unix(0, 1234),
			V: "some sample",
		}

		jsn, err := json.Marshal(&row)

		require.NoError(t, err)
		require.JSONEq(t, `["1234", "some sample"]`, string(jsn))
	})

	t.Run("unmarshal", func(t *testing.T) {
		jsn := []byte(`["1234", "some sample"]`)

		row := Sample{}
		err := json.Unmarshal(jsn, &row)

		require.NoError(t, err)
		require.Equal(t, int64(1234), row.T.UnixNano())
		require.Equal(t, "some sample", row.V)
	})

	t.Run("unmarshal invalid", func(t *testing.T) {
		jsn := []byte(`{"key": "wrong shape"}`)

		row := Sample{}
		err := json.Unmarshal(jsn, &row)

		require.ErrorContains(t, err, "failed to deserialize sample")
	})

	t.Run("unmarshal bad timestamp", func(t *testing.T) {
		jsn := []byte(`["not-unix-nano", "some sample"]`)

		row := Sample{}
		err := json.Unmarshal(jsn, &row)

		require.ErrorContains(t, err, "timestamp in Loki sample")
	})
}

func TestStream(t *testing.T) {
	t.Run("marshal", func(t *testing.T) {
		stream := Stream{
			Stream: map[string]string{"a": "b"},
			Values: []Sample{
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

func TestClampRange(t *testing.T) {
	tc := []struct {
		name     string
		oldRange []int64
		max      int64
		newRange []int64
	}{
		{
			name:     "clamps start value if max is smaller than range",
			oldRange: []int64{5, 10},
			max:      1,
			newRange: []int64{9, 10},
		},
		{
			name:     "returns same values if max is greater than range",
			oldRange: []int64{5, 10},
			max:      20,
			newRange: []int64{5, 10},
		},
		{
			name:     "returns same values if max is equal to range",
			oldRange: []int64{5, 10},
			max:      5,
			newRange: []int64{5, 10},
		},
		{
			name:     "returns same values if max is zero",
			oldRange: []int64{5, 10},
			max:      0,
			newRange: []int64{5, 10},
		},
	}

	for _, c := range tc {
		t.Run(c.name, func(t *testing.T) {
			start, end := ClampRange(c.oldRange[0], c.oldRange[1], c.max)

			require.Equal(t, c.newRange[0], start)
			require.Equal(t, c.newRange[1], end)
		})
	}
}

func createTestLokiClient(req client.Requester) *HttpLokiClient {
	url, _ := url.Parse("http://some.url")
	cfg := LokiConfig{
		WritePathURL: url,
		ReadPathURL:  url,
		Encoder:      JsonEncoder{},
	}
	met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem)
	return NewLokiClient(cfg, req, met.BytesWritten, met.WriteDuration, log.NewNopLogger(), tracing.InitializeTracerForTest(), lokiClientSpanName)
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

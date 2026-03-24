package v0alpha1

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"
)

func newTestClient(t *testing.T, handler http.Handler) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	cfg := rest.Config{
		Host:    srv.URL,
		APIPath: "/apis",
	}
	client, err := NewClient(cfg, "test-ns")
	require.NoError(t, err)
	return client
}

func TestHistorianClient_NotificationQuery(t *testing.T) {
	var gotPath string
	var gotMethod string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		resp := CreateNotificationqueryResponse{}
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	})

	client := newTestClient(t, handler)
	_, err := client.NotificationQuery(context.Background(), CreateNotificationqueryRequestBody{})
	require.NoError(t, err)
	require.Equal(t, "POST", gotMethod)
	require.Equal(t, "/apis/historian.alerting.grafana.app/v0alpha1/namespaces/test-ns/notification/query", gotPath)
}

func TestHistorianClient_NotificationsQueryAlerts(t *testing.T) {
	var gotPath string
	var gotMethod string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		resp := CreateNotificationsqueryalertsResponse{}
		require.NoError(t, json.NewEncoder(w).Encode(resp))
	})

	client := newTestClient(t, handler)
	_, err := client.NotificationsQueryAlerts(context.Background(), CreateNotificationsqueryalertsRequestBody{})
	require.NoError(t, err)
	require.Equal(t, "POST", gotMethod)
	require.Equal(t, "/apis/historian.alerting.grafana.app/v0alpha1/namespaces/test-ns/notifications/queryalerts", gotPath)
}

func TestHistorianClient_AlertStateHistory(t *testing.T) {
	ts := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name    string
		frame   *data.Frame
		params  url.Values
		entries []AlertStateHistoryEntry
	}{
		{
			name:    "empty frame with no fields",
			frame:   data.NewFrame("history"),
			params:  url.Values{},
			entries: nil,
		},
		{
			name: "empty frame with fields but no rows",
			frame: data.NewFrame("history",
				data.NewField("time", nil, []time.Time{}),
				data.NewField("line", nil, []json.RawMessage{}),
			),
			params:  url.Values{},
			entries: nil,
		},
		{
			name: "single entry",
			frame: data.NewFrame("history",
				data.NewField("time", nil, []time.Time{ts}),
				data.NewField("line", nil, []json.RawMessage{
					json.RawMessage(`{"schemaVersion":1,"previous":"Normal","current":"Alerting","ruleUID":"rule-1","ruleTitle":"Test Rule","labels":{"alertname":"test"}}`),
				}),
			),
			params: url.Values{
				"ruleUID": []string{"abc-123"},
				"from":    []string{"1700000000"},
				"to":      []string{"1700003600"},
				"limit":   []string{"50"},
			},
			entries: []AlertStateHistoryEntry{
				{
					Timestamp:     ts,
					SchemaVersion: 1,
					Previous:      "Normal",
					Current:       "Alerting",
					RuleUID:       "rule-1",
					RuleTitle:     "Test Rule",
					Labels:        map[string]string{"alertname": "test"},
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var gotPath string
			var gotMethod string
			var gotQuery url.Values
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				gotMethod = r.Method
				gotQuery = r.URL.Query()
				require.NoError(t, json.NewEncoder(w).Encode(tc.frame))
			})

			client := newTestClient(t, handler)
			resp, err := client.AlertStateHistory(context.Background(), tc.params)
			require.NoError(t, err)
			require.Equal(t, tc.entries, resp.Entries)
			require.Equal(t, "GET", gotMethod)
			require.Equal(t, "/apis/historian.alerting.grafana.app/v0alpha1/namespaces/test-ns/alertstate/history", gotPath)
			for k, v := range tc.params {
				require.Equal(t, v[0], gotQuery.Get(k))
			}
		})
	}
}

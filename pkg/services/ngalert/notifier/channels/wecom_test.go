package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWeComNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       map[string]interface{}
		expInitError string
		expMsgError  error
	}{
		{
			name:     "Default config with one alert",
			settings: `{"url": "http://localhost"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"markdown": map[string]interface{}{
					"content": "# [FIRING:1]  (val1)\n**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n\n",
				},
				"msgtype": "markdown",
			},
			expMsgError: nil,
		},
		{
			name: "Custom config with multiple alerts",
			settings: `{
				"url": "http://localhost",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"markdown": map[string]interface{}{
					"content": "# [FIRING:2]  \n2 alerts are firing, 0 are resolved\n",
				},
				"msgtype": "markdown",
			},
			expMsgError: nil,
		},
		{
			name: "Custom title and message with multiple alerts",
			settings: `{
				"url": "http://localhost",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved",
				"title": "This notification is {{ .Status }}!"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"markdown": map[string]interface{}{
					"content": "# This notification is firing!\n2 alerts are firing, 0 are resolved\n",
				},
				"msgtype": "markdown",
			},
			expMsgError: nil,
		},
		{
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: `either url or secret is required`,
		},
		{
			name:     "Use default if optional fields are explicitly empty",
			settings: `{"url": "http://localhost", "message": "", "title": ""}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"markdown": map[string]interface{}{
					"content": "# [FIRING:1]  (val1)\n**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n\n",
				},
				"msgtype": "markdown",
			},
			expMsgError: nil,
		},
		{
			name:     "Use text are explicitly empty",
			settings: `{"url": "http://localhost", "message": "", "title": "", "msgtype": "text"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"text": map[string]interface{}{
					"content": "[FIRING:1]  (val1)\n**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n\n",
				},
				"msgtype": "text",
			},
			expMsgError: nil,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON := json.RawMessage(c.settings)

			m := &NotificationChannelConfig{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: settingsJSON,
			}

			webhookSender := mockNotificationService()

			fc := FactoryConfig{
				Config:              m,
				NotificationService: webhookSender,
				DecryptFunc: func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
					return fallback
				},
				ImageStore: nil,
				Template:   tmpl,
				Logger:     &FakeLogger{},
			}

			pn, err := buildWecomNotifier(fc)
			if c.expInitError != "" {
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})

			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}

// TestWeComNotifierAPIAPP Testing API Channels
func TestWeComNotifierAPIAPP(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	tests := []struct {
		name         string
		settings     string
		statusCode   int
		accessToken  string
		alerts       []*types.Alert
		expMsg       map[string]interface{}
		expInitError string
		expMsgError  error
	}{
		{
			name:         "not AgentID",
			settings:     `{"secret": "secret"}`,
			accessToken:  "access_token",
			expInitError: "could not find AgentID in settings",
		},
		{
			name:         "not CorpID",
			settings:     `{"secret": "secret", "agent_id": "agent_id"}`,
			accessToken:  "access_token",
			expInitError: "could not find CorpID in settings",
		},
		{
			name:         "Default APIAPP config with one alert",
			settings:     `{"secret": "secret", "agent_id": "agent_id", "corp_id": "corp_id"}`,
			accessToken:  "access_token",
			expInitError: "",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"markdown": map[string]interface{}{
					"content": "# [FIRING:1]  (val1)\n**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n\n",
				},
				"msgtype": "markdown",
				"agentid": "agent_id",
				"touser":  "@all",
			},
		},
		{
			name: "Custom message(markdown) with multiple alert",
			settings: `{
				"secret": "secret", "agent_id": "agent_id", "corp_id": "corp_id",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"}
			`,
			accessToken:  "access_token",
			expInitError: "",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"markdown": map[string]interface{}{
					"content": "# [FIRING:2]  \n2 alerts are firing, 0 are resolved\n",
				},
				"msgtype": "markdown",
				"agentid": "agent_id",
				"touser":  "@all",
			},
			expMsgError: nil,
		},
		{
			name: "Custom message(Text) with multiple alert",
			settings: `{
				"secret": "secret", "agent_id": "agent_id", "corp_id": "corp_id",
				"msgtype": "text",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"}
			`,
			accessToken:  "access_token",
			expInitError: "",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"text": map[string]interface{}{
					"content": "[FIRING:2]  \n2 alerts are firing, 0 are resolved\n",
				},
				"msgtype": "text",
				"agentid": "agent_id",
				"touser":  "@all",
			},
			expMsgError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				accessToken := r.URL.Query().Get("access_token")
				if accessToken != tt.accessToken {
					t.Errorf("Expected access_token=%s got %s", tt.accessToken, accessToken)
					return
				}

				expBody, err := json.Marshal(tt.expMsg)
				require.NoError(t, err)

				b, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				require.JSONEq(t, string(expBody), string(b))
			}))
			defer server.Close()

			m := &NotificationChannelConfig{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: json.RawMessage(tt.settings),
			}

			webhookSender := mockNotificationService()

			fc := FactoryConfig{
				Config:              m,
				NotificationService: webhookSender,
				DecryptFunc: func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
					return fallback
				},
				ImageStore: nil,
				Template:   tmpl,
				Logger:     &FakeLogger{},
			}

			pn, err := buildWecomNotifier(fc)
			if tt.expInitError != "" {
				require.Equal(t, tt.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})

			// Avoid calling GetAccessToken interfaces
			pn.tokExpireAt = time.Now().Add(10 * time.Second)
			pn.tok = &WeComAccessToken{AccessToken: tt.accessToken}

			ok, err := pn.Notify(ctx, tt.alerts...)
			if tt.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, tt.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			expBody, err := json.Marshal(tt.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}

func TestWeComNotifier_GetAccessToken(t *testing.T) {
	type fields struct {
		tok         *WeComAccessToken
		tokExpireAt time.Time
		corpid      string
		secret      string
	}
	tests := []struct {
		name    string
		fields  fields
		want    string
		wantErr assert.ErrorAssertionFunc
	}{
		{
			name: "no corpid",
			fields: fields{
				tok:         nil,
				tokExpireAt: time.Now().Add(-time.Minute),
			},
			want: "",
			wantErr: func(t assert.TestingT, err error, i ...interface{}) bool {
				return assert.Error(t, err, i...)
			},
		},
		{
			name: "no corpsecret",
			fields: fields{
				tok:         nil,
				tokExpireAt: time.Now().Add(-time.Minute),
			},
			want: "",
			wantErr: func(t assert.TestingT, err error, i ...interface{}) bool {
				return assert.Error(t, err, i...)
			},
		},
		{
			name: "get access token",
			fields: fields{
				corpid: "corpid",
				secret: "secret",
			},
			want:    "access_token",
			wantErr: assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				corpid := r.URL.Query().Get("corpid")
				corpsecret := r.URL.Query().Get("corpsecret")

				assert.Equal(t, corpid, tt.fields.corpid, fmt.Sprintf("Expected corpid=%s got %s", tt.fields.corpid, corpid))
				if len(corpid) == 0 {
					w.WriteHeader(http.StatusBadRequest)
					return
				}

				assert.Equal(t, corpsecret, tt.fields.secret, fmt.Sprintf("Expected corpsecret=%s got %s", tt.fields.secret, corpsecret))
				if len(corpsecret) == 0 {
					w.WriteHeader(http.StatusBadRequest)
					return
				}

				b, err := json.Marshal(map[string]interface{}{
					"errcode":      0,
					"errmsg":       "ok",
					"access_token": tt.want,
					"expires_in":   7200,
				})
				assert.NoError(t, err)
				w.WriteHeader(http.StatusOK)
				_, err = w.Write(b)
				assert.NoError(t, err)
			}))
			defer server.Close()

			w := &WeComNotifier{
				settings: wecomSettings{
					EndpointURL: server.URL,
					CorpID:      tt.fields.corpid,
					Secret:      tt.fields.secret,
				},
				tok:         tt.fields.tok,
				tokExpireAt: tt.fields.tokExpireAt,
			}
			got, err := w.GetAccessToken(context.Background())
			if !tt.wantErr(t, err, "GetAccessToken()") {
				return
			}
			assert.Equalf(t, tt.want, got, "GetAccessToken()")
		})
	}
}

func TestWeComFactory(t *testing.T) {
	tests := []struct {
		name     string
		settings string
		wantErr  assert.ErrorAssertionFunc
	}{
		{
			name:     "null",
			settings: "{}",
			wantErr: func(t assert.TestingT, err error, i ...interface{}) bool {
				return assert.Contains(t, err.Error(), "either url or secret is required", i...)
			},
		},
		{
			name:     "webhook url",
			settings: `{"url": "https://example.com"}`,
			wantErr:  assert.NoError,
		},
		{
			name:     "apiapp missing AgentID",
			settings: `{"secret": "secret"}`,
			wantErr: func(t assert.TestingT, err error, i ...interface{}) bool {
				return assert.Contains(t, err.Error(), "could not find AgentID in settings", i...)
			},
		},
		{
			name:     "apiapp missing CorpID",
			settings: `{"secret": "secret", "agent_id": "agent_id"}`,
			wantErr: func(t assert.TestingT, err error, i ...interface{}) bool {
				return assert.Contains(t, err.Error(), "could not find CorpID in settings", i...)
			},
		},
		{
			name:     "apiapp",
			settings: `{"secret": "secret", "agent_id": "agent_id", "corp_id": "corp_id"}`,
			wantErr:  assert.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &NotificationChannelConfig{
				Name:     "wecom_testing",
				Type:     "wecom",
				Settings: json.RawMessage(tt.settings),
			}

			webhookSender := mockNotificationService()

			fc := FactoryConfig{
				Config:              m,
				NotificationService: webhookSender,
				DecryptFunc: func(ctx context.Context, sjd map[string][]byte, key string, fallback string) string {
					return fallback
				},
				ImageStore: nil,
				Logger:     &FakeLogger{},
			}

			_, err := WeComFactory(fc)
			if !tt.wantErr(t, err, fmt.Sprintf("WeComFactory(%v)", fc)) {
				return
			}
		})
	}
}

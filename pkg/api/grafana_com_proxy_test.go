package api

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSSOTokenAllowedPath(t *testing.T) {
	tests := []struct {
		name      string
		proxyPath string
		allowed   bool
	}{
		{name: "plugins list", proxyPath: "plugins", allowed: true},
		{name: "plugin by id", proxyPath: "plugins/grafana-clock-panel", allowed: true},
		{name: "plugin entitlement", proxyPath: "plugins/grafana-clock-panel/entitlement", allowed: true},
		{name: "plugin entitlement leading slash", proxyPath: "/plugins/grafana-clock-panel/entitlement", allowed: true},
		{name: "plugin versions", proxyPath: "plugins/grafana-clock-panel/versions", allowed: true},
		{name: "dashboards list", proxyPath: "dashboards", allowed: true},
		{name: "entitlement subpath", proxyPath: "plugins/grafana-clock-panel/entitlement/extra", allowed: false},
		{name: "unrelated path", proxyPath: "plugins/grafana-clock-panel/install", allowed: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ssoTokenAllowedPath(tt.proxyPath); got != tt.allowed {
				t.Errorf("ssoTokenAllowedPath(%q) = %v, want %v", tt.proxyPath, got, tt.allowed)
			}
		})
	}
}

func TestGrowthCohortProxyAuthorization(t *testing.T) {
	for _, tt := range []struct {
		name, method, path string
		authorized         bool
	}{
		{"membership GET", "GET", "growth/cohorts/123", true},
		{"leading slash", "GET", "/growth/cohorts/123", true},
		{"write", "POST", "growth/cohorts/123", false},
		{"other growth endpoint", "GET", "growth/extension/123", false},
		{"nested path", "GET", "growth/cohorts/123/extra", false},
		{"invalid organization", "GET", "growth/cohorts/../123", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var authorization, cookie string
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				authorization = r.Header.Get("Authorization")
				cookie = r.Header.Get("Cookie")
				w.WriteHeader(http.StatusOK)
			}))
			defer upstream.Close()
			proxy := ReverseProxyGnetReq(log.New("test"), tt.path, "test", upstream.URL, "server-token")
			req := httptest.NewRequest(tt.method, "/api/gnet/"+tt.path, nil)
			req.Header.Set("Authorization", "Bearer browser-token")
			req.Header.Set("Cookie", "session=browser-cookie")
			res := httptest.NewRecorder()
			proxy.ServeHTTP(res, req)
			require.Equal(t, http.StatusOK, res.Code)
			want := ""
			if tt.authorized {
				want = "Bearer server-token"
			}
			require.Equal(t, want, authorization)
			require.Empty(t, cookie)
		})
	}
}

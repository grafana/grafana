package api

import (
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

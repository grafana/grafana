package router

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

func forwardSpec(url string) v1alpha2.RouteBackendSpec {
	return v1alpha2.RouteBackendSpec{
		Mode:    v1alpha2.RouteBackendSpecModeForward,
		Forward: &v1alpha2.RouteBackendCommonBackendConfig{Url: url},
	}
}

func TestNewForwardBackendAcceptsValidURL(t *testing.T) {
	_, err := NewForwardBackend(app.ManifestData{Group: "dashboard.grafana.app"}, forwardSpec("https://backend.internal:8080"), "1", &http.Transport{})
	if err != nil {
		t.Fatalf("NewForwardBackend() = %v, want nil for a valid absolute URL", err)
	}
}

// TestNewForwardBackendRejectsURLsWithoutHost pins that a Forward backend is
// rejected at construction time (route-build time) when its URL has no
// scheme/host -- url.Parse alone accepts empty and relative values without
// error, so without this check a misconfigured group gets published and
// fails every request at proxy time instead (502, tripping the per-group
// breaker), rather than being caught when the route is built.
func TestNewForwardBackendRejectsURLsWithoutHost(t *testing.T) {
	cases := []string{
		"",             // empty
		"/just/a/path", // relative, no scheme/host
		"backend:8080", // no scheme -- url.Parse treats "backend" as the scheme, not the host
	}
	for _, url := range cases {
		_, err := NewForwardBackend(app.ManifestData{Group: "dashboard.grafana.app"}, forwardSpec(url), "1", &http.Transport{})
		if err == nil {
			t.Errorf("NewForwardBackend(url=%q) = nil error, want an error (no scheme/host)", url)
		}
	}
}

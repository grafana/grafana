package pluginroute

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
)

type nopHandler struct{}

func (nopHandler) ServeHTTP(http.ResponseWriter, *http.Request) {}

// Most requests are for the API server's own resources, so the cost of
// deciding a request is not a manifest route is paid on nearly every call.
func BenchmarkRouteMuxPassThrough(b *testing.B) {
	manifest := testManifest(b)
	builder := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	handler := builder.routeMux(nopHandler{}, prometheus.NewRegistry())
	for name, path := range map[string]string{
		"list":   "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds",
		"get":    "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds/thing-1",
		"status": "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds/thing-1/status",
	} {
		b.Run(name, func(b *testing.B) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			b.ReportAllocs()
			for b.Loop() {
				handler.ServeHTTP(rec, req)
			}
		})
	}
}

// The documents of versions without kinds are checked for on every request
// to a full handler whose manifest has any.
func BenchmarkVersionDocumentsPassThrough(b *testing.B) {
	manifest := testManifest(b)
	builder := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	documents, err := builder.versionDocuments(builder.kindlessVersions())
	if err != nil {
		b.Fatal(err)
	}
	handler := documents(nopHandler{})
	req := httptest.NewRequest(http.MethodGet, "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds", nil)
	rec := httptest.NewRecorder()
	b.ReportAllocs()
	for b.Loop() {
		handler.ServeHTTP(rec, req)
	}
}

// The router's own work on a request that is for a manifest route, up to the
// call to the plugin, which is stubbed out.
func BenchmarkRouteMuxManifestRoute(b *testing.B) {
	manifest := testManifest(b)
	builder := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app", clientV3: &fakeRouteClient{}}
	handler := builder.routeMux(nopHandler{}, prometheus.NewRegistry())
	for name, req := range map[string]*http.Request{
		"version route":      httptest.NewRequest(http.MethodGet, "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/foobar", nil),
		"undeclared method":  httptest.NewRequest(http.MethodPost, "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/foobar", nil),
		"undeclared subtree": httptest.NewRequest(http.MethodGet, "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/foobar/other", nil),
	} {
		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				handler.ServeHTTP(httptest.NewRecorder(), req)
			}
		})
	}
}

package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// handlerName responds with a fixed name so tests can assert which handler served a request.
func handlerName(name string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(name))
	})
}

func serve(t *testing.T, m *PathMux, path string) string {
	t.Helper()
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Body.String()
}

// TestPrefixLongestMatch pins longest-prefix-match dispatch. This guards the byPrefixPriority
// comparator, which drops the k8s slash-count key in favor of length alone; a regression here
// means the ordering no longer routes overlapping prefixes to the most specific handler.
func TestPrefixLongestMatch(t *testing.T) {
	m := NewPathMux("test")
	m.HandlePrefix("/apis/", handlerName("apis"))
	m.HandlePrefix("/apis/dashboard.grafana.app/", handlerName("dashboard"))
	m.HandlePrefix("/apis/dashboard.grafana.app/v1alpha1/", handlerName("v1alpha1"))

	cases := map[string]string{
		"/apis/other/x":                          "apis",
		"/apis/dashboard.grafana.app/foo":        "dashboard",
		"/apis/dashboard.grafana.app/v1alpha1/x": "v1alpha1",
	}
	for path, want := range cases {
		if got := serve(t, m, path); got != want {
			t.Errorf("path %q: got handler %q, want %q", path, got, want)
		}
	}
}

// TestExactBeatsPrefix ensures an exact registration wins over an overlapping prefix.
func TestExactBeatsPrefix(t *testing.T) {
	m := NewPathMux("test")
	m.HandlePrefix("/apis/", handlerName("prefix"))
	m.Handle("/apis/exact", handlerName("exact"))

	if got := serve(t, m, "/apis/exact"); got != "exact" {
		t.Errorf("got %q, want exact", got)
	}
	if got := serve(t, m, "/apis/other"); got != "prefix" {
		t.Errorf("got %q, want prefix", got)
	}
}

// TestUnregisteredIsNotFound ensures unmatched paths hit the not-found handler.
func TestUnregisteredIsNotFound(t *testing.T) {
	m := NewPathMux("test")
	m.HandlePrefix("/apis/", handlerName("apis"))

	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/nope", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("got status %d, want 404", rec.Code)
	}
}

package filters

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWithOpenAPIV3NotFound(t *testing.T) {
	silent := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("{}"))
	})
	notModified := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotModified)
	})

	for _, tc := range []struct {
		name    string
		path    string
		handler http.Handler
		code    int
	}{
		{"unserved group version", "/openapi/v3/apis/nosuch.grafana.app/v1", silent, http.StatusNotFound},
		{"served group version", "/openapi/v3/apis/example.grafana.app/v1", ok, http.StatusOK},
		{"unchanged document", "/openapi/v3/apis/example.grafana.app/v1", notModified, http.StatusNotModified},
		// httptest reports 200 for a handler that writes nothing.
		{"other paths are untouched", "/apis/nosuch.grafana.app/v1", silent, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			WithOpenAPIV3NotFound(tc.handler).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, tc.path, nil))
			require.Equal(t, tc.code, rr.Code)
		})
	}
}

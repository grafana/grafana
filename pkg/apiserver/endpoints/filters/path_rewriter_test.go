package filters

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_WithPathRewriters(t *testing.T) {
	mockHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(r.URL.Path))
		require.NoError(t, err)
	})

	rewriters := []PathRewriter{
		{
			Pattern: regexp.MustCompile(`(/apis/scope.grafana.app/.*/query)(/.*)`),
			ReplaceFunc: func(matches []string) string {
				return matches[1]
			},
		}, {
			Pattern: regexp.MustCompile(`/apis/query.grafana.app/v0alpha1(.*$)`),
			ReplaceFunc: func(matches []string) string {
				return "/apis/datasource.grafana.app/v0alpha1" + matches[1]
			},
		},
	}
	handler := WithPathRewriters(mockHandler, rewriters)

	t.Run("should rewrite path", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/apis/scope.grafana.app/namespaces/stacks-1234/query/blah", nil)
		assert.NoError(t, err)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "/apis/scope.grafana.app/namespaces/stacks-1234/query", rr.Body.String())
	})

	t.Run("should rewrite query service", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/apis/query.grafana.app/v0alpha1/something", nil)
		assert.NoError(t, err)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "/apis/datasource.grafana.app/v0alpha1/something", rr.Body.String())
	})

	t.Run("should ignore requests that don't match", func(t *testing.T) {
		req, err := http.NewRequest("GET", "/apis/scope.grafana.app/namespaces/stacks-1234/scopes/1", nil)
		assert.NoError(t, err)
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "/apis/scope.grafana.app/namespaces/stacks-1234/scopes/1", rr.Body.String())
	})
}

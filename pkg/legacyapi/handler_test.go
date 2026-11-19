package legacyapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewHandler(t *testing.T) {
	h := NewHandler(Config{})

	cases := []struct {
		method string
		path   string
		status int
	}{
		{http.MethodGet, "/api/dashboards/uid/abc", http.StatusUnauthorized},
		{http.MethodPost, "/api/dashboards/uid/abc", http.StatusMethodNotAllowed},
		{http.MethodGet, "/api/search", http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), tc.method, tc.path, nil))
			assert.Equal(t, tc.status, rec.Code)
		})
	}
}

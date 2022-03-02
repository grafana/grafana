package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestServeHTTP(t *testing.T) {
	m := New()
	m.Use(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		rw.WriteHeader(http.StatusOK)
	}))
	startTestServer(t, m)

	testCases := []struct {
		name               string
		urlPath            string
		expectedStatusCode int
		expectedURLPath    string
	}{
		{
			name:               "Valid path / should return unmodified path",
			urlPath:            "/",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/",
		},
		{
			name:               "Valid path /api/test should return unmodified path",
			urlPath:            "/api/test",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api/test",
		},
		{
			name:               "Invalid path /api/test/../ should return modified path",
			urlPath:            "/api/test/../",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api",
		},
		{
			name:               "Invalid path /api/test/%2E%2E/ should return modified path",
			urlPath:            "/api/test/%2E%2E/",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api",
		},
		{
			name:               "Invalid path /api/test/%2e%2e%2f should return modified path",
			urlPath:            "/api/test/%2e%2e%2f",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api",
		},
		{
			name:               "Invalid path /api/test/../a should return modified path",
			urlPath:            "/api/test/../a",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api/a",
		},
		{
			name:               "Invalid path /api/test/%2E%2E/a should return modified path",
			urlPath:            "/api/test/%2E%2E/a",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api/a",
		},
		{
			name:               "Invalid path /api/test/%2e%2e%2fa should return modified path",
			urlPath:            "/api/test/%2e%2e%2fa",
			expectedStatusCode: http.StatusOK,
			expectedURLPath:    "/api/a",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.urlPath, nil)
			recorder := httptest.NewRecorder()
			m.ServeHTTP(recorder, req)
			require.Equal(t, tc.expectedStatusCode, recorder.Result().StatusCode)
			require.Equal(t, tc.expectedURLPath, req.URL.Path)
		})
	}
}

func startTestServer(t *testing.T, m *Macaron) {
	t.Helper()

	s := httptest.NewServer(m)
	t.Cleanup(s.Close)
}

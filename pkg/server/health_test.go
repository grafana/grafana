package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthNotifier_DefaultNotReady(t *testing.T) {
	h := NewHealthNotifier()
	assert.False(t, h.IsReady())
}

func TestHealthNotifier_SetReady(t *testing.T) {
	h := NewHealthNotifier()
	h.SetReady()
	assert.True(t, h.IsReady())
}

func TestHealthNotifier_SetNotReady(t *testing.T) {
	h := NewHealthNotifier()
	h.SetReady()
	h.SetNotReady()
	assert.False(t, h.IsReady())
}

func TestLivezHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/livez", nil)
	rec := httptest.NewRecorder()

	LivezHandler().ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "OK", rec.Body.String())
}

func TestReadyzHandler_NotReady(t *testing.T) {
	h := NewHealthNotifier()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	ReadyzHandler(h).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.Equal(t, "not ready", rec.Body.String())
}

func TestReadyzHandler_Ready(t *testing.T) {
	h := NewHealthNotifier()
	h.SetReady()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	ReadyzHandler(h).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "OK", rec.Body.String())
}

func TestReadyzHandler_NilNotifier(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	ReadyzHandler(nil).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.Equal(t, "not ready", rec.Body.String())
}

func TestRegisterHealthEndpoints(t *testing.T) {
	h := NewHealthNotifier()
	router := mux.NewRouter()
	RegisterHealthEndpoints(router, h)

	srv := httptest.NewServer(router)
	defer srv.Close()

	t.Run("livez returns 200", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/livez")
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "OK", string(body))
	})

	t.Run("readyz returns 503 when not ready", func(t *testing.T) {
		resp, err := http.Get(srv.URL + "/readyz")
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		assert.Equal(t, "not ready", string(body))
	})

	t.Run("readyz returns 200 after SetReady", func(t *testing.T) {
		h.SetReady()
		resp, err := http.Get(srv.URL + "/readyz")
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "OK", string(body))
	})

	t.Run("readyz returns 503 after SetNotReady", func(t *testing.T) {
		h.SetNotReady()
		resp, err := http.Get(srv.URL + "/readyz")
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)
		assert.Equal(t, "not ready", string(body))
	})

	t.Run("livez rejects POST", func(t *testing.T) {
		resp, err := http.Post(srv.URL+"/livez", "text/plain", nil)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode)
	})

	t.Run("readyz rejects POST", func(t *testing.T) {
		resp, err := http.Post(srv.URL+"/readyz", "text/plain", nil)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()
		assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode)
	})
}

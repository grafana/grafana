package swagger

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/web"
)

func TestHandler_HandleRequest(t *testing.T) {
	t.Run("should render the nonce the core CSP middleware put on the request context", func(t *testing.T) {
		handler := newHandler(newTestCfg(t), &licensing.OSSLicensingService{})

		// On the core server the ReqContext is already on the request context
		// when the handler runs, so the handler reads the nonce from there.
		reqCtx := &contextmodel.ReqContext{RequestNonce: "test-nonce"}
		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		req = req.WithContext(context.WithValue(req.Context(), ctxkey.Key{}, reqCtx))

		recorder := httptest.NewRecorder()
		handler.handleRequest(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), `nonce="test-nonce"`)
	})

	t.Run("should render without a nonce when there is no request context", func(t *testing.T) {
		handler := newHandler(newTestCfg(t), &licensing.OSSLicensingService{})

		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()
		handler.handleRequest(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), `nonce=""`)
	})

	t.Run("should return an error when the swagger bundle is missing", func(t *testing.T) {
		cfg := newTestCfg(t)
		require.NoError(t, os.Remove(filepath.Join(cfg.StaticRootPath, buildDir, "assets-manifest.json")))

		handler := newHandler(cfg, &licensing.OSSLicensingService{})

		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()
		handler.handleRequest(recorder, req)

		assert.GreaterOrEqual(t, recorder.Code, http.StatusInternalServerError)
	})
}

func TestHandler_ContentDeliveryURL(t *testing.T) {
	cfg := newTestCfg(t)
	cfg.BuildVersion = "10.3.0"
	cdnRoot, err := url.Parse("https://cdn.example.com/")
	require.NoError(t, err)
	cfg.CDNRootURL = cdnRoot

	// OSSLicensingService.ContentDeliveryPrefix reports "grafana-oss".
	handler := newHandler(cfg, &licensing.OSSLicensingService{})

	req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
	recorder := httptest.NewRecorder()
	handler.handleRequest(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(),
		`src="https://cdn.example.com/grafana-oss/10.3.0/public/build-swagger/swagger.js"`)
}

func TestRegisterRoutes(t *testing.T) {
	rr := routing.NewRouteRegister()
	RegisterRoutes(rr, newTestCfg(t), &licensing.OSSLicensingService{})

	mux := web.New()
	rr.Register(mux)

	t.Run("should mount the swagger page on the route register", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/swagger", nil))

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), "<title>Grafana API Reference</title>")
	})

	t.Run("should redirect the deprecated /swagger-ui to /swagger", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/swagger-ui", nil))

		assert.Equal(t, http.StatusMovedPermanently, recorder.Code)
		assert.Equal(t, "/swagger", recorder.Header().Get("Location"))
	})

	t.Run("should not mount the removed /openapi3 redirect", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/openapi3", nil))

		assert.Equal(t, http.StatusNotFound, recorder.Code)
	})
}

// failingWriter accepts headers but fails every body write with err.
type failingWriter struct {
	*httptest.ResponseRecorder
	err error
}

func (w *failingWriter) Write([]byte) (int, error) { return 0, w.err }

func TestHandler_RenderErrors(t *testing.T) {
	handler := newHandler(newTestCfg(t), &licensing.OSSLicensingService{})

	t.Run("should return quietly when the client has gone away", func(t *testing.T) {
		w := &failingWriter{ResponseRecorder: httptest.NewRecorder(), err: syscall.EPIPE}

		assert.NotPanics(t, func() {
			handler.handleRequest(w, httptest.NewRequest(http.MethodGet, "/swagger", nil))
		})
	})

	t.Run("should panic on any other render error", func(t *testing.T) {
		w := &failingWriter{ResponseRecorder: httptest.NewRecorder(), err: errors.New("disk full")}

		assert.PanicsWithValue(t, "Error rendering swagger\n disk full", func() {
			handler.handleRequest(w, httptest.NewRequest(http.MethodGet, "/swagger", nil))
		})
	})
}

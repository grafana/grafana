package swagger

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
)

func TestHandler_HandleRequest(t *testing.T) {
	t.Run("should render the nonce the core CSP middleware put on the request context", func(t *testing.T) {
		handler := NewHandler(newTestCfg(t), &licensing.OSSLicensingService{})

		// The core HTTPServer resolves the ReqContext before the handler runs, so
		// the handler reads the nonce off the request context rather than having
		// the ReqContext injected as an argument.
		reqCtx := &contextmodel.ReqContext{RequestNonce: "test-nonce"}
		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		req = req.WithContext(context.WithValue(req.Context(), ctxkey.Key{}, reqCtx))

		recorder := httptest.NewRecorder()
		handler.HandleRequest(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), `nonce="test-nonce"`)
	})

	t.Run("should render without a nonce when there is no request context", func(t *testing.T) {
		handler := NewHandler(newTestCfg(t), &licensing.OSSLicensingService{})

		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()
		handler.HandleRequest(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), `nonce=""`)
	})

	t.Run("should return an error when the swagger bundle is missing", func(t *testing.T) {
		cfg := newTestCfg(t)
		require.NoError(t, os.Remove(filepath.Join(cfg.StaticRootPath, buildDir, "assets-manifest.json")))

		handler := NewHandler(cfg, &licensing.OSSLicensingService{})

		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()
		handler.HandleRequest(recorder, req)

		assert.GreaterOrEqual(t, recorder.Code, http.StatusInternalServerError)
	})
}

func TestHandleRedirect(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/openapi3", nil)
	recorder := httptest.NewRecorder()

	HandleRedirect(recorder, req)

	assert.Equal(t, http.StatusMovedPermanently, recorder.Code)
	assert.Equal(t, "/swagger", recorder.Header().Get("Location"))
}

func TestHandler_ContentDeliveryURL(t *testing.T) {
	cfg := newTestCfg(t)
	cfg.BuildVersion = "10.3.0"
	cdnRoot, err := url.Parse("https://cdn.example.com/")
	require.NoError(t, err)
	cfg.CDNRootURL = cdnRoot

	// OSSLicensingService.ContentDeliveryPrefix reports "grafana-oss".
	handler := NewHandler(cfg, &licensing.OSSLicensingService{})

	req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
	recorder := httptest.NewRecorder()
	handler.HandleRequest(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(),
		`src="https://cdn.example.com/grafana-oss/10.3.0/public/build-swagger/swagger.js"`)
}

package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func Test_Middleware(t *testing.T) {
	t.Run("rejects POST method", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/dimension-keys?region=us-east-1", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
			return []byte{}, nil
		}, logger, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusMethodNotAllowed, rr.Code)
	})

	t.Run("injects plugincontext to handler", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/some-path", nil)
		var testPluginContext backend.PluginContext
		handler := http.HandlerFunc(ResourceRequestMiddleware(func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
			testPluginContext = pluginCtx
			return []byte{}, nil
		}, logger, nil))
		handler.ServeHTTP(rr, req)
		assert.NotNil(t, testPluginContext)
	})

	t.Run("should propagate handler error to response", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/some-path", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
			return []byte{}, models.NewHttpError("error", http.StatusBadRequest, fmt.Errorf("error from handler"))
		}, logger, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Equal(t, `{"Message":"error: error from handler","Error":"error from handler","StatusCode":400}`, rr.Body.String())
	})
}

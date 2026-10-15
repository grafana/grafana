package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-openapi/loads"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
)

func TestAuthorize(t *testing.T) {
	json, err := os.ReadFile(filepath.Join("tooling", "spec.json"))
	require.NoError(t, err)
	swaggerSpec, err := loads.Analyzed(json, "")
	require.NoError(t, err)

	paths := make(map[string][]string)

	for p, item := range swaggerSpec.Spec().Paths.Paths {
		var methods []string

		if item.Get != nil {
			methods = append(methods, http.MethodGet)
		}
		if item.Put != nil {
			methods = append(methods, http.MethodPut)
		}
		if item.Post != nil {
			methods = append(methods, http.MethodPost)
		}
		if item.Delete != nil {
			methods = append(methods, http.MethodDelete)
		}
		if item.Patch != nil {
			methods = append(methods, http.MethodPatch)
		}
		paths[p] = methods
	}
	require.Len(t, paths, 65)

	ac := acmock.New()
	api := &API{AccessControl: ac, FeatureManager: featuremgmt.WithFeatures()}

	t.Run("should have an authorization entry for known routes", func(t *testing.T) {
		for path, methods := range paths {
			path := swaggerSpec.Spec().BasePath + path
			for _, method := range methods {
				_, ok := api.authorizeHandler(method, path)
				require.Truef(t, ok, "no authorization entry for method [%s] of endpoint [%s]", method, path)
			}
		}
	})

	t.Run("should return 500 if route is unknown", func(t *testing.T) {
		_, ok := api.authorizeHandler("test", "test")
		require.False(t, ok)

		rec := invokeHandler(t, api.authorize("test", "test"))
		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Contains(t, rec.Body.String(), "Authorization is not configured for this endpoint")
	})
}

func invokeHandler(t *testing.T, h web.Handler) *httptest.ResponseRecorder {
	t.Helper()
	fn, ok := h.(func(*contextmodel.ReqContext))
	require.True(t, ok, "unexpected handler type %T", h)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	fn(&contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(http.MethodGet, rec)}, Logger: log.NewNopLogger()})
	return rec
}

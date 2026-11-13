package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestParseJSONOrYAML_MaxBodyBytes(t *testing.T) {
	t.Run("should reject body exceeding max bytes limit", func(t *testing.T) {
		// Create a body that is larger than the limit
		largeBody := strings.Repeat("a", 100)
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(largeBody))
		req.Header.Set("content-type", "application/yaml")
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		var target map[string]interface{}
		err := parseJSONOrYAML(ctx, &target, 10) // 10 bytes limit
		require.Error(t, err)
		require.Contains(t, err.Error(), "request body too large")
		require.Contains(t, err.Error(), "max size 10 bytes")
	})

	t.Run("should accept body within max bytes limit", func(t *testing.T) {
		body := `name: test`
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(body))
		req.Header.Set("content-type", "application/yaml")
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		var target map[string]interface{}
		err := parseJSONOrYAML(ctx, &target, 1024) // 1KB limit, body is small
		require.NoError(t, err)
		require.Equal(t, "test", target["name"])
	})

	t.Run("should not limit body when maxBodyBytes is 0", func(t *testing.T) {
		// Even a large body should be accepted when limit is 0
		body := `name: test`
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(body))
		req.Header.Set("content-type", "application/yaml")
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		var target map[string]interface{}
		err := parseJSONOrYAML(ctx, &target, 0)
		require.NoError(t, err)
		require.Equal(t, "test", target["name"])
	})

	t.Run("should not limit body when maxBodyBytes is negative", func(t *testing.T) {
		// Negative values are treated the same as 0 (no limit).
		// Config validation prevents negative values, but parseJSONOrYAML
		// should still behave safely if one is passed.
		body := `name: test`
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(body))
		req.Header.Set("content-type", "application/yaml")
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		var target map[string]interface{}
		err := parseJSONOrYAML(ctx, &target, -1)
		require.NoError(t, err)
		require.Equal(t, "test", target["name"])
	})

	t.Run("should reject JSON body exceeding max bytes limit", func(t *testing.T) {
		largeBody := `{"name": "` + strings.Repeat("a", 100) + `"}`
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(largeBody))
		req.Header.Set("content-type", "application/json")
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		var target map[string]interface{}
		err := parseJSONOrYAML(ctx, &target, 10)
		require.Error(t, err)
		require.Contains(t, err.Error(), "request body too large")
	})
}

func TestHandlerPostRuleGroups_MaxBodyBytes(t *testing.T) {
	t.Run("should return 413 when body exceeds limit", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		srv.cfg.PrometheusConversion.MaxRequestBodyBytes = 10
		handler := NewConvertPrometheusApi(srv)

		largeBody := strings.Repeat("a", 100)
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(largeBody))
		req.Header.Set("content-type", "application/yaml")
		req.Header.Set(datasourceUIDHeader, existingDSUID)
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		resp := handler.handleRouteConvertPrometheusPostRuleGroups(ctx)
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.Status())
	})

	t.Run("should return 413 for single rule group when body exceeds limit", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		srv.cfg.PrometheusConversion.MaxRequestBodyBytes = 10
		handler := NewConvertPrometheusApi(srv)

		largeBody := strings.Repeat("a", 100)
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(largeBody))
		req.Header.Set("content-type", "application/yaml")
		req.Header.Set(datasourceUIDHeader, existingDSUID)
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		resp := handler.handleRouteConvertPrometheusPostRuleGroup(ctx, "test-namespace")
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.Status())
	})

	t.Run("should return 413 for alertmanager config when body exceeds limit", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		srv.cfg.PrometheusConversion.MaxRequestBodyBytes = 10
		handler := NewConvertPrometheusApi(srv)

		largeBody := strings.Repeat("a", 100)
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(largeBody))
		req.Header.Set("content-type", "application/yaml")
		req.Header.Set(datasourceUIDHeader, existingDSUID)
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		resp := handler.handleRouteConvertPrometheusPostAlertmanagerConfig(ctx)
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.Status())
	})

	t.Run("should not limit when maxBodyBytes is 0", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		srv.cfg.PrometheusConversion.MaxRequestBodyBytes = 0
		handler := NewConvertPrometheusApi(srv)

		// Valid YAML body for a PrometheusRuleGroup map
		body := "test-namespace:\n  - name: test\n    rules: []\n"
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(body))
		req.Header.Set("content-type", "application/yaml")
		req.Header.Set(datasourceUIDHeader, existingDSUID)
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		resp := handler.handleRouteConvertPrometheusPostRuleGroups(ctx)
		// Should not be 413 — the body is valid but the group has no rules,
		// so it could be 202 or a different status depending on business logic.
		// The key assertion is that it did NOT get rejected for body size.
		require.NotEqual(t, http.StatusRequestEntityTooLarge, resp.Status())
	})
}

func TestErrorToResponse_MaxBytesError(t *testing.T) {
	t.Run("should return 413 for bare MaxBytesError", func(t *testing.T) {
		err := &http.MaxBytesError{Limit: 100}
		resp := errorToResponse(err)
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.Status())
	})

	t.Run("should return 413 for wrapped MaxBytesError", func(t *testing.T) {
		inner := &http.MaxBytesError{Limit: 100}
		err := fmt.Errorf("request body too large: max size 100 bytes: %w", inner)
		resp := errorToResponse(err)
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.Status())
	})
}

func TestConvertPrometheusApiHandler_CortexWrappers(t *testing.T) {
	t.Run("cortex post rule groups should also enforce body limit", func(t *testing.T) {
		srv, _, _ := createConvertPrometheusSrv(t)
		srv.cfg.PrometheusConversion.MaxRequestBodyBytes = 10
		handler := NewConvertPrometheusApi(srv)

		largeBody := strings.Repeat("a", 100)
		req := httptest.NewRequest("POST", "http://localhost", strings.NewReader(largeBody))
		req.Header.Set("content-type", "application/yaml")
		req.Header.Set(datasourceUIDHeader, existingDSUID)
		recorder := httptest.NewRecorder()

		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			SignedInUser: &user.SignedInUser{OrgID: 1},
		}

		resp := handler.handleRouteConvertPrometheusCortexPostRuleGroups(ctx)
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.Status())
	})
}

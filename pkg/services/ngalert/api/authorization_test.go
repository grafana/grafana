package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-openapi/loads"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/setting"
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
	require.Len(t, paths, 58)

	ac := acmock.New()
	api := &API{AccessControl: ac}

	t.Run("should not panic on known routes", func(t *testing.T) {
		for path, methods := range paths {
			path := swaggerSpec.Spec().BasePath + path
			for _, method := range methods {
				require.NotPanics(t, func() {
					api.authorize(method, path)
				})
			}
		}
	})

	t.Run("should panic if route is unknown", func(t *testing.T) {
		require.Panics(t, func() {
			api.authorize("test", "test")
		})
	})
}

func TestBlock(t *testing.T) {
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

	t.Run("should block provisioning write operations if block_provisioning_write_ops is set", func(t *testing.T) {
		ac := acmock.New()
		api := &API{AccessControl: ac, Cfg: &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{BlockProvisioningWriteOps: true}}}

		server := web.New()

		for path, methods := range paths {
			path := swaggerSpec.Spec().BasePath + path
			for _, method := range methods {
				shouldBeBlocked := false
				for _, blockedRoutes := range BLOCKED_ROUTES {
					if path == blockedRoutes {
						if method != http.MethodGet {
							shouldBeBlocked = true
						}
					}
				}

				h := api.block(method, path)
				if shouldBeBlocked {
					t.Log(method, path, "should be blocked")
					require.NotNil(t, h)
					server.Use(h)
					request, err := http.NewRequest(method, path, nil)
					assert.NoError(t, err)
					recorder := httptest.NewRecorder()

					server.ServeHTTP(recorder, request)
					require.Equal(t, http.StatusForbidden, recorder.Code)
				} else {
					t.Log(method, path, "should not be blocked")
					require.Nil(t, h, "%s %s should not be blocked", method, path)
				}
			}
		}
	})

	t.Run("should not block provisioning write operations if block_provisioning_write_ops is not set", func(t *testing.T) {
		ac := acmock.New()
		api := &API{AccessControl: ac, Cfg: &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{BlockProvisioningWriteOps: false}}}

		for path, methods := range paths {
			path := swaggerSpec.Spec().BasePath + path
			for _, method := range methods {
				h := api.block(method, path)
				require.Nil(t, h, "%s %s should not be blocked", method, path)
			}
		}
	})
}

package api

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-openapi/loads"
	"github.com/stretchr/testify/require"

	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	require.Len(t, paths, 66)

	ac := acmock.New()
	api := &API{AccessControl: ac, FeatureManager: featuremgmt.WithFeatures()}

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

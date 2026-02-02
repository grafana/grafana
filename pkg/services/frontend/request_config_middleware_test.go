package frontend

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestConfigMiddleware(t *testing.T) {
	t.Run("should store base config in request context", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				BuildInfo: dtos.FrontendSettingsBuildInfoDTO{
					Version: "10.3.0",
					Edition: "Open Source",
				},
				AnonymousEnabled: true,
			},
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(baseConfig)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, baseConfig.CSPEnabled, capturedConfig.CSPEnabled)
		assert.Equal(t, baseConfig.CSPTemplate, capturedConfig.CSPTemplate)
		assert.Equal(t, baseConfig.AppURL, capturedConfig.AppURL)
		assert.Equal(t, baseConfig.AnonymousEnabled, capturedConfig.AnonymousEnabled)
		assert.Equal(t, baseConfig.BuildInfo.Version, capturedConfig.BuildInfo.Version)
		assert.Equal(t, baseConfig.BuildInfo.Edition, capturedConfig.BuildInfo.Edition)
	})

	t.Run("should call next handler", func(t *testing.T) {
		baseConfig := FSRequestConfig{}
		middleware := RequestConfigMiddleware(baseConfig)

		nextCalled := false
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.True(t, nextCalled, "Next handler should be called")
		assert.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("should work with minimal config", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{},
		}

		middleware := RequestConfigMiddleware(baseConfig)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, false, capturedConfig.CSPEnabled)
		assert.Equal(t, "", capturedConfig.CSPTemplate)
	})
}

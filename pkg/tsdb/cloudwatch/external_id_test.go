package cloudwatch

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_external_id_route(t *testing.T) {
	t.Run("successfully returns stack external id for legacy datasources", func(t *testing.T) {
		t.Setenv("AWS_AUTH_EXTERNAL_ID", "mock-external-id")
		rr := httptest.NewRecorder()

		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.GrafanaSettings.ExternalID = "mock-external-id"
		})
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.ExternalIdHandler))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":"mock-external-id"}`, rr.Body.String())
	})

	t.Run("returns stack external id even when per-datasource mode is enabled", func(t *testing.T) {
		rr := httptest.NewRecorder()
		usePerDS := true

		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.GrafanaSettings.ExternalID = "stack-id"
			ds.Settings.GrafanaExternalID = "stackABC-dsUid1"
			ds.Settings.UsePerDatasourceExternalID = &usePerDS
		})
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.ExternalIdHandler))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":"stack-id"}`, rr.Body.String())
	})

	t.Run("returns stack external id when bool unset even if per-DS ID is stored", func(t *testing.T) {
		rr := httptest.NewRecorder()

		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.GrafanaSettings.ExternalID = "stack-id"
			ds.Settings.GrafanaExternalID = "stackABC-dsUid1"
		})
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.ExternalIdHandler))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":"stack-id"}`, rr.Body.String())
	})

	t.Run("returns an empty string if there is no external id", func(t *testing.T) {
		rr := httptest.NewRecorder()

		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.ExternalIdHandler))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":""}`, rr.Body.String())
	})
}

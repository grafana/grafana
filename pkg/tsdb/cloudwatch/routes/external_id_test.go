package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_external_id_route(t *testing.T) {
	t.Run("successfully returns an external id from the env", func(t *testing.T) {
		t.Setenv("AWS_AUTH_EXTERNAL_ID", "mock-external-id")
		rr := httptest.NewRecorder()

		handler := http.HandlerFunc(ResourceRequestMiddleware(ExternalIdHandler, logger, nil))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":"mock-external-id"}`, rr.Body.String())
	})

	t.Run("returns an empty string if there is no external id", func(t *testing.T) {
		rr := httptest.NewRecorder()

		handler := http.HandlerFunc(ResourceRequestMiddleware(ExternalIdHandler, logger, nil))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":""}`, rr.Body.String())
	})
}

package routes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func Test_external_id_route(t *testing.T) {
	t.Run("successfully returns an external id from the instance", func(t *testing.T) {
		t.Setenv("AWS_AUTH_EXTERNAL_ID", "mock-external-id")
		rr := httptest.NewRecorder()

		factoryFunc := func(_ context.Context, _ backend.PluginContext, region string) (reqCtx models.RequestContext, err error) {
			return models.RequestContext{
				Settings: models.CloudWatchSettings{
					GrafanaSettings: awsds.AuthSettings{ExternalID: "mock-external-id"},
				},
			}, nil
		}
		handler := http.HandlerFunc(ResourceRequestMiddleware(ExternalIdHandler, logger, factoryFunc))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":"mock-external-id"}`, rr.Body.String())
	})

	t.Run("returns an empty string if there is no external id", func(t *testing.T) {
		rr := httptest.NewRecorder()

		factoryFunc := func(_ context.Context, _ backend.PluginContext, region string) (reqCtx models.RequestContext, err error) {
			return models.RequestContext{
				Settings: models.CloudWatchSettings{},
			}, nil
		}
		handler := http.HandlerFunc(ResourceRequestMiddleware(ExternalIdHandler, logger, factoryFunc))
		req := httptest.NewRequest("GET", "/external-id", nil)

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"externalId":""}`, rr.Body.String())
	})
}

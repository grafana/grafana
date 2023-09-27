package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
	"github.com/stretchr/testify/assert"
)

func Test_accounts_route(t *testing.T) {
	origNewAccountsService := newAccountsService
	t.Cleanup(func() {
		newAccountsService = origNewAccountsService
	})

	t.Run("successfully returns array of accounts json", func(t *testing.T) {
		mockAccountsService := mocks.AccountsServiceMock{}
		mockAccountsService.On("GetAccountsForCurrentUserOrRole").Return([]resources.ResourceResponse[resources.Account]{{
			Value: resources.Account{
				Id:                  "123456789012",
				Arn:                 "some arn",
				Label:               "some label",
				IsMonitoringAccount: true,
			},
		}}, nil)
		newAccountsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.AccountsProvider, error) {
			return &mockAccountsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(AccountsHandler, logger, nil))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[{"value":{"id":"123456789012", "arn":"some arn", "isMonitoringAccount":true, "label":"some label"}}]`, rr.Body.String())
	})

	t.Run("rejects POST method", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(AccountsHandler, logger, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusMethodNotAllowed, rr.Code)
	})

	t.Run("requires region query value", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(AccountsHandler, logger, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("returns 403 when accounts service returns ErrAccessDeniedException", func(t *testing.T) {
		mockAccountsService := mocks.AccountsServiceMock{}
		mockAccountsService.On("GetAccountsForCurrentUserOrRole").Return([]resources.ResourceResponse[resources.Account](nil),
			fmt.Errorf("%w: %s", services.ErrAccessDeniedException, "some AWS message"))
		newAccountsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.AccountsProvider, error) {
			return &mockAccountsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(AccountsHandler, logger, nil))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusForbidden, rr.Code)
		assert.JSONEq(t,
			`{"Message":"error getting accounts for current user or role: access denied. please check your IAM policy: some AWS message",
			"Error":"access denied. please check your IAM policy: some AWS message","StatusCode":403}`, rr.Body.String())
	})

	t.Run("returns 500 when accounts service returns unknown error", func(t *testing.T) {
		mockAccountsService := mocks.AccountsServiceMock{}
		mockAccountsService.On("GetAccountsForCurrentUserOrRole").Return([]resources.ResourceResponse[resources.Account](nil), fmt.Errorf("some error"))
		newAccountsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.AccountsProvider, error) {
			return &mockAccountsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(AccountsHandler, logger, nil))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"error getting accounts for current user or role: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
	})
}

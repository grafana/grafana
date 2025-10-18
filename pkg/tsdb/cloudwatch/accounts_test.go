package cloudwatch

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-aws-sdk/pkg/awsauth"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"

	"github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/assert"
)

func newTestDatasource(opts ...func(*DataSource)) *DataSource {
	ds := &DataSource{
		AWSConfigProvider: awsauth.NewFakeConfigProvider(false),
		logger:            log.NewNullLogger(),
		tagValueCache:     cache.New(0, 0),
		Settings: models.CloudWatchSettings{
			AWSDatasourceSettings: awsds.AWSDatasourceSettings{Region: "us-east-1"},
		},
	}
	ds.resourceHandler = httpadapter.New(ds.newResourceMux())
	for _, opt := range opts {
		opt(ds)
	}
	return ds
}

func Test_accounts_route(t *testing.T) {
	ds := newTestDatasource()
	origNewAccountsService := services.NewAccountsService
	t.Cleanup(func() {
		services.NewAccountsService = origNewAccountsService
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
		services.NewAccountsService = func(_ models.OAMAPIProvider) models.AccountsProvider {
			return &mockAccountsService
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.AccountsHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[{"value":{"id":"123456789012", "arn":"some arn", "isMonitoringAccount":true, "label":"some label"}}]`, rr.Body.String())
	})

	t.Run("rejects POST method", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.AccountsHandler))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusMethodNotAllowed, rr.Code)
	})

	t.Run("requires region query value", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts", nil)
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.AccountsHandler))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("returns 403 when accounts service returns ErrAccessDeniedException", func(t *testing.T) {
		mockAccountsService := mocks.AccountsServiceMock{}
		mockAccountsService.On("GetAccountsForCurrentUserOrRole").Return([]resources.ResourceResponse[resources.Account](nil),
			fmt.Errorf("%w: %s", services.ErrAccessDeniedException, "some AWS message"))
		services.NewAccountsService = func(_ models.OAMAPIProvider) models.AccountsProvider {
			return &mockAccountsService
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.AccountsHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusForbidden, rr.Code)
		assert.JSONEq(t,
			`{"Message":"error getting accounts for current user or role: access denied. please check your IAM policy: some AWS message",
			"Error":"access denied. please check your IAM policy: some AWS message","StatusCode":403}`, rr.Body.String())
	})

	t.Run("returns 500 when accounts service returns unknown error", func(t *testing.T) {
		mockAccountsService := mocks.AccountsServiceMock{}
		mockAccountsService.On("GetAccountsForCurrentUserOrRole").Return([]resources.ResourceResponse[resources.Account](nil), fmt.Errorf("some error"))
		services.NewAccountsService = func(_ models.OAMAPIProvider) models.AccountsProvider {
			return &mockAccountsService
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/accounts?region=us-east-1", nil)
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.AccountsHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"error getting accounts for current user or role: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
	})
}

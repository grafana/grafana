package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestLogGroupsRoute(t *testing.T) {
	origLogGroupsService := newLogGroupsService
	t.Cleanup(func() {
		newLogGroupsService = origLogGroupsService
	})

	mockFeatures := mocks.MockFeatures{}
	mockFeatures.On("IsEnabled", featuremgmt.FlagCloudWatchCrossAccountQuerying).Return(false)
	reqCtxFunc := func(pluginCtx backend.PluginContext, region string) (reqCtx models.RequestContext, err error) {
		return models.RequestContext{Features: &mockFeatures}, err
	}

	t.Run("successfully returns 1 log group with account id", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{{
			Value: resources.LogGroup{
				Arn:  "some arn",
				Name: "some name",
			},
			AccountId: utils.Pointer("111"),
		}}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[{"value":{"name":"some name", "arn":"some arn"},"accountId":"111"}]`, rr.Body.String())
	})

	t.Run("successfully returns multiple log groups with account id", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return(
			[]resources.ResourceResponse[resources.LogGroup]{
				{
					Value: resources.LogGroup{
						Arn:  "arn 1",
						Name: "name 1",
					},
					AccountId: utils.Pointer("111"),
				}, {
					Value: resources.LogGroup{
						Arn:  "arn 2",
						Name: "name 2",
					},
					AccountId: utils.Pointer("222"),
				},
			}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[
		   {
			  "value":{
				 "name":"name 1",
				 "arn":"arn 1"
			  },
			  "accountId":"111"
		   },
		   {
			  "value":{
				 "name":"name 2",
				 "arn":"arn 2"
			  },
			  "accountId":"222"
		   }
		]`, rr.Body.String())
	})

	t.Run("returns error when both logGroupPrefix and logGroup Pattern are provided", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups?logGroupNamePrefix=some-prefix&logGroupPattern=some-pattern", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.JSONEq(t, `{"Error":"cannot set both log group name prefix and pattern", "Message":"cannot set both log group name prefix and pattern: cannot set both log group name prefix and pattern", "StatusCode":400}`, rr.Body.String())
	})

	t.Run("passes default log group limit and nil for logGroupNamePrefix, accountId, and logGroupPattern", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		mockLogsService.AssertCalled(t, "GetLogGroups", resources.LogGroupsRequest{
			Limit:               50,
			ResourceRequest:     resources.ResourceRequest{},
			LogGroupNamePrefix:  nil,
			LogGroupNamePattern: nil,
		})
	})

	t.Run("passes default log group limit and nil for logGroupNamePrefix when both are absent", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		mockLogsService.AssertCalled(t, "GetLogGroups", resources.LogGroupsRequest{
			Limit:              50,
			LogGroupNamePrefix: nil,
		})
	})

	t.Run("passes log group limit from query parameter", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups?limit=2", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		mockLogsService.AssertCalled(t, "GetLogGroups", resources.LogGroupsRequest{
			Limit: 2,
		})
	})

	t.Run("passes logGroupPrefix from query parameter", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups?logGroupNamePrefix=some-prefix", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		mockLogsService.AssertCalled(t, "GetLogGroups", resources.LogGroupsRequest{
			Limit:              50,
			LogGroupNamePrefix: utils.Pointer("some-prefix"),
		})
	})

	t.Run("passes logGroupPattern from query parameter", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups?logGroupPattern=some-pattern", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		mockLogsService.AssertCalled(t, "GetLogGroups", resources.LogGroupsRequest{
			Limit:               50,
			LogGroupNamePattern: utils.Pointer("some-pattern"),
		})
	})

	t.Run("passes logGroupPattern from query parameter", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroup]{}, nil)
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups?accountId=some-account-id", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		mockLogsService.AssertCalled(t, "GetLogGroups", resources.LogGroupsRequest{
			Limit:           50,
			ResourceRequest: resources.ResourceRequest{AccountId: utils.Pointer("some-account-id")},
		})
	})

	t.Run("returns error if service returns error", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroups", mock.Anything).
			Return([]resources.ResourceResponse[resources.LogGroup]{}, fmt.Errorf("some error"))
		newLogGroupsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.LogGroupsProvider, error) {
			return &mockLogsService, nil
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-groups", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(LogGroupsHandler, logger, reqCtxFunc))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.JSONEq(t, `{"Error":"some error","Message":"GetLogGroups error: some error","StatusCode":500}`, rr.Body.String())
	})
}

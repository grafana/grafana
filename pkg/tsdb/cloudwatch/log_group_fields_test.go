package cloudwatch

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func TestLogGroupFieldsRoute(t *testing.T) {
	origLogGroupsService := services.NewLogGroupsService
	t.Cleanup(func() {
		services.NewLogGroupsService = origLogGroupsService
	})
	t.Run("returns 400 if an invalid LogGroupFieldsRequest is used", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/log-group-fields?region=us-east-2`, nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.LogGroupFieldsHandler))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Equal(t, `{"Message":"error in LogGroupFieldsHandler: you need to specify either logGroupName or logGroupArn","Error":"you need to specify either logGroupName or logGroupArn","StatusCode":400}`, rr.Body.String())
	})

	t.Run("returns 500 if GetLogGroupFields method fails", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroupFields", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroupField]{}, fmt.Errorf("error from api"))
		services.NewLogGroupsService = func(_ models.CloudWatchLogsAPIProvider, _ bool) models.LogGroupsProvider {
			return &mockLogsService
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-group-fields?region=us-east-2&logGroupName=test", nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.LogGroupFieldsHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"GetLogGroupFields error: error from api","Error":"error from api","StatusCode":500}`, rr.Body.String())
	})

	t.Run("returns valid json response if everything is ok", func(t *testing.T) {
		mockLogsService := mocks.LogsService{}
		mockLogsService.On("GetLogGroupFields", mock.Anything).Return([]resources.ResourceResponse[resources.LogGroupField]{
			{
				AccountId: new(string),
				Value: resources.LogGroupField{
					Name:    "field1",
					Percent: 50,
				},
			},
			{
				AccountId: new(string),
				Value: resources.LogGroupField{
					Name:    "field2",
					Percent: 50,
				},
			},
		}, nil)
		services.NewLogGroupsService = func(_ models.CloudWatchLogsAPIProvider, _ bool) models.LogGroupsProvider {
			return &mockLogsService
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/log-group-fields?region=us-east-2&logGroupName=test", nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.LogGroupFieldsHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[{"accountId":"","value":{"name":"field1","percent":50}},{"accountId":"","value":{"name":"field2","percent":50}}]`, rr.Body.String())
	})
}

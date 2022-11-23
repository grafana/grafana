package handlers

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func TestAnnotationHandler(t *testing.T) {
	origNewService := newService
	t.Cleanup(func() {
		newService = origNewService
	})
	var mockService mocks.AnnotationServiceMock
	var fakeServiceFunc = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.AnnotationProvider, error) {
		return &mockService, nil
	}

	newService = fakeServiceFunc

	t.Run("Should return unmarshal error when incorrect data type are used in json", func(t *testing.T) {
		res := AnnotationHandler(context.Background(), mocks.QueryDataRequest, mocks.GetDataQuery(mocks.QueryWithWrongDataType), nil)
		assert.EqualError(t, res.Error, "failed to unmarshal JSON request into query: json: cannot unmarshal number into Go struct field AnnotationQuery.Region of type string")
	})

	t.Run("Should return error when not able to create client", func(t *testing.T) {
		// use real client factory in this test
		newService = origNewService
		var factoryFunc models.RequestContextFactoryFunc = func(pluginCtx backend.PluginContext, region string) (models.RequestContext, error) {
			return models.RequestContext{}, errors.New("error creating client")
		}
		res := AnnotationHandler(context.Background(), mocks.QueryDataRequest, mocks.GetDataQuery(mocks.StandardQuery), factoryFunc)
		assert.EqualError(t, res.Error, "failed to fetch query data: error creating client")
		newService = fakeServiceFunc
	})

	t.Run("Should set default values if missing in raw query", func(t *testing.T) {
		mockService = mocks.AnnotationServiceMock{}
		AnnotationHandler(context.Background(), mocks.QueryDataRequest, mocks.GetDataQuery(mocks.StandardQuery), nil)
		assert.Len(t, mockService.CallsGetAlarmNamesByMetric, 1)
		assert.Equal(t, int64(300), mockService.CallsGetAlarmNamesByMetric[0].PeriodInt)
	})

	t.Run("Should call GetAlarmNamesByPrefixMatching if prefix matching is enabled", func(t *testing.T) {
		mockService = mocks.AnnotationServiceMock{}
		AnnotationHandler(context.Background(), mocks.QueryDataRequest, mocks.GetDataQuery(mocks.PrefixMatchingQuery), nil)
		assert.Len(t, mockService.CallsGetAlarmNamesByPrefixMatching, 1)
		assert.Len(t, mockService.CallsGetAlarmNamesByMetric, 0)
	})

	tests := []string{
		strings.Replace(mocks.StandardQuery, `"namespace": "EC2"`, `"namespace": ""`, 1),
		strings.Replace(mocks.StandardQuery, `"metricName": "CPUUtilization"`, `"metricName": ""`, 1),
		strings.Replace(mocks.StandardQuery, `"statistic": "Average"`, `"statistic": ""`, 1),
		strings.Replace(mocks.StandardQuery, `"region":    "us-east-2"`, `"region": ""`, 1),
	}

	for _, tc := range tests {
		t.Run("Should return error if a metric query is missing a required arg", func(t *testing.T) {
			mockService = mocks.AnnotationServiceMock{}
			res := AnnotationHandler(context.Background(), mocks.QueryDataRequest, mocks.GetDataQuery(tc), nil)

			assert.EqualError(t, res.Error, "bad request: Region, Namespace, MetricName and Statistic are required")
		})
	}
}

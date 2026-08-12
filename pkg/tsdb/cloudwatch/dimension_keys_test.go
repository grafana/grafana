package cloudwatch

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func Test_DimensionKeys_Route(t *testing.T) {
	origNewListMetricsService := services.NewListMetricsService
	t.Cleanup(func() {
		services.NewListMetricsService = origNewListMetricsService
	})

	var mockListMetricsService mocks.ListMetricsServiceMock
	services.NewListMetricsService = func(models.MetricsClientProvider) models.ListMetricsProvider {
		return &mockListMetricsService
	}

	t.Run("calls FilterDimensionKeysRequest when a StandardDimensionKeysRequest is passed", func(t *testing.T) {
		mockListMetricsService = mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetDimensionKeysByDimensionFilter", mock.MatchedBy(func(r resources.DimensionKeysRequest) bool {
			return r.ResourceRequest != nil && *r.ResourceRequest == resources.ResourceRequest{Region: "us-east-2"} &&
				r.Namespace == "AWS/EC2" &&
				r.MetricName == "CPUUtilization" &&
				len(r.DimensionFilter) == 2 &&
				assert.Contains(t, r.DimensionFilter, &resources.Dimension{Name: "NodeID", Value: "Shared"}) &&
				assert.Contains(t, r.DimensionFilter, &resources.Dimension{Name: "stage", Value: "QueryCommit"})
		})).Return([]resources.ResourceResponse[string]{}, nil).Once()
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`, nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.DimensionKeysHandler))
		handler.ServeHTTP(rr, req)
	})

	t.Run("calls GetHardCodedDimensionKeysByNamespace when a StandardDimensionKeysRequest is passed", func(t *testing.T) {
		origGetHardCodedDimensionKeysByNamespace := services.GetHardCodedDimensionKeysByNamespace
		t.Cleanup(func() {
			services.GetHardCodedDimensionKeysByNamespace = origGetHardCodedDimensionKeysByNamespace
		})
		haveBeenCalled := false
		usedNamespace := ""
		services.GetHardCodedDimensionKeysByNamespace = func(namespace string) ([]resources.ResourceResponse[string], error) {
			haveBeenCalled = true
			usedNamespace = namespace
			return []resources.ResourceResponse[string]{}, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization", nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.DimensionKeysHandler))
		handler.ServeHTTP(rr, req)
		res := []resources.Metric{}
		err := json.Unmarshal(rr.Body.Bytes(), &res)
		require.Nil(t, err)
		assert.True(t, haveBeenCalled)
		assert.Equal(t, "AWS/EC2", usedNamespace)
	})

	t.Run("return 500 if GetDimensionKeysByDimensionFilter returns an error", func(t *testing.T) {
		mockListMetricsService = mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetDimensionKeysByDimensionFilter", mock.Anything).Return([]resources.ResourceResponse[string]{}, fmt.Errorf("some error"))
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`, nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.DimensionKeysHandler))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"error in DimensionKeyHandler: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
	})
}

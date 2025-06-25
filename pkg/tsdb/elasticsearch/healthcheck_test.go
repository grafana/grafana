package elasticsearch

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/stretchr/testify/assert"
)

var mockedCfg = backend.WithGrafanaConfig(context.Background(), backend.NewGrafanaCfg(map[string]string{featuretoggles.EnabledFeatures: "elasticsearchCrossClusterSearch"}))

func Test_Healthcheck_OK(t *testing.T) {
	service := GetMockService(http.StatusOK, "200 OK", `{"status":"green"}`, `{"fields":{"timestamp":{"date":{"metadata_field":true}}}}`)
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	assert.Equal(t, "Elasticsearch data source is healthy.", res.Message)
}

func Test_Healthcheck_Timeout(t *testing.T) {
	service := GetMockService(http.StatusRequestTimeout, "408 Request Timeout", `{"status":"red"}`, `{"fields":{"timestamp":{"date":{"metadata_field":true}}}}`)
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Health check failed: Elasticsearch data source is not healthy. Request timed out", res.Message)
}

func Test_Healthcheck_Error(t *testing.T) {
	service := GetMockService(http.StatusBadGateway, "502 Bad Gateway", `{"status":"red"}`, `{"fields":{"timestamp":{"date":{"metadata_field":true}}}}`)
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Health check failed: Elasticsearch data source is not healthy. Status: 502 Bad Gateway", res.Message)
}

func Test_validateIndex_Warning_ErrorValidatingIndex(t *testing.T) {
	service := GetMockService(http.StatusOK, "200 OK", `{"status":"green"}`, `{"error":{"reason":"index_not_found"}}`)
	res, _ := service.CheckHealth(mockedCfg, &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	assert.Equal(t, "Elasticsearch data source is healthy. Warning: Error validating index: index_not_found", res.Message)
}

func Test_validateIndex_Warning_WrongTimestampType(t *testing.T) {
	service := GetMockService(http.StatusOK, "200 OK", `{"status":"green"}`, `{"fields":{"timestamp":{"float":{"metadata_field":true}}}}`)
	res, _ := service.CheckHealth(mockedCfg, &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	assert.Equal(t, "Elasticsearch data source is healthy. Warning: Could not find time field 'timestamp' with type date in index", res.Message)
}
func Test_validateIndex_Error_FailedToUnmarshalValidateResponse(t *testing.T) {
	service := GetMockService(http.StatusOK, "200 OK", `{"status":"green"}`, `\\\///{"fields":null}"`)
	res, _ := service.CheckHealth(mockedCfg, &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Failed to unmarshal field capabilities response", res.Message)
}
func Test_validateIndex_Success_SuccessValidatingIndex(t *testing.T) {
	service := GetMockService(http.StatusOK, "200 OK", `{"status":"green"}`, `{"fields":{"timestamp":{"date":{"metadata_field":true}}}}`)
	res, _ := service.CheckHealth(mockedCfg, &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	assert.Equal(t, "Elasticsearch data source is healthy.", res.Message)
}

type FakeRoundTripper struct {
	statusCode            int
	status                string
	index                 int
	elasticSearchResponse string
	fieldCapsResponse     string
}

func (fakeRoundTripper *FakeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	var res *http.Response
	if fakeRoundTripper.index == 0 {
		if fakeRoundTripper.statusCode == http.StatusOK {
			res = &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body:       io.NopCloser(bytes.NewBufferString(fakeRoundTripper.elasticSearchResponse)),
			}
		} else {
			res = &http.Response{
				StatusCode: fakeRoundTripper.statusCode,
				Status:     fakeRoundTripper.status,
				Body:       io.NopCloser(bytes.NewBufferString(fakeRoundTripper.elasticSearchResponse)),
			}
		}
		fakeRoundTripper.index++
	} else {
		res = &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(bytes.NewBufferString(fakeRoundTripper.fieldCapsResponse)),
		}
	}
	return res, nil
}

type FakeInstanceManager struct {
	statusCode            int
	status                string
	elasticSearchResponse string
	fieldCapsResponse     string
}

func (fakeInstanceManager *FakeInstanceManager) Get(tx context.Context, pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	httpClient, _ := httpclient.New(httpclient.Options{})
	httpClient.Transport = &FakeRoundTripper{statusCode: fakeInstanceManager.statusCode, status: fakeInstanceManager.status, elasticSearchResponse: fakeInstanceManager.elasticSearchResponse, fieldCapsResponse: fakeInstanceManager.fieldCapsResponse, index: 0}

	return es.DatasourceInfo{
		HTTPClient: httpClient,
		ConfiguredFields: es.ConfiguredFields{
			TimeField: "timestamp",
		},
	}, nil
}

func (*FakeInstanceManager) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func GetMockService(statusCode int, status string, elasticSearchResponse string, fieldCapsResponse string) *Service {
	return &Service{
		im:     &FakeInstanceManager{statusCode: statusCode, status: status, elasticSearchResponse: elasticSearchResponse, fieldCapsResponse: fieldCapsResponse},
		logger: log.New(),
	}
}

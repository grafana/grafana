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
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/stretchr/testify/assert"
)

func Test_Healthcheck_OK(t *testing.T) {
	service := GetMockService(http.StatusOK, "200 OK")
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	assert.Equal(t, "Elasticsearch data source is healthy", res.Message)
}

func Test_Healthcheck_Timeout(t *testing.T) {
	service := GetMockService(http.StatusRequestTimeout, "408 Request Timeout")
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Elasticsearch data source is not healthy", res.Message)
}

func Test_Healthcheck_Error(t *testing.T) {
	service := GetMockService(http.StatusBadGateway, "502 Bad Gateway")
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Elasticsearch data source is not healthy. Status: 502 Bad Gateway", res.Message)
}

type FakeRoundTripper struct {
	statusCode int
	status     string
}

func (fakeRoundTripper *FakeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	var res *http.Response
	if fakeRoundTripper.statusCode == http.StatusOK {
		res = &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(bytes.NewBufferString("{\"status\":\"green\"}")),
		}
	} else {
		res = &http.Response{
			StatusCode: fakeRoundTripper.statusCode,
			Status:     fakeRoundTripper.status,
			Body:       io.NopCloser(bytes.NewBufferString("{\"status\":\"red\"}")),
		}
	}
	return res, nil
}

type FakeInstanceManager struct {
	statusCode int
	status     string
}

func (fakeInstanceManager *FakeInstanceManager) Get(tx context.Context, pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	httpClient, _ := httpclient.New(httpclient.Options{})
	httpClient.Transport = &FakeRoundTripper{statusCode: fakeInstanceManager.statusCode, status: fakeInstanceManager.status}

	return es.DatasourceInfo{
		HTTPClient: httpClient,
	}, nil
}

func (*FakeInstanceManager) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func GetMockService(statusCode int, status string) *Service {
	return &Service{
		im:     &FakeInstanceManager{statusCode: statusCode, status: status},
		logger: log.New(),
	}
}

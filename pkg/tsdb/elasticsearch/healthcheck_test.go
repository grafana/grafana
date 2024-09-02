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
	service := GetMockService(true)
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusOk, res.Status)
	assert.Equal(t, "Elasticsearch data source is healthy", res.Message)
}

func Test_Healthcheck_Timeout(t *testing.T) {
	service := GetMockService(false)
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Elasticsearch data source is not healthy", res.Message)
}

type FakeRoundTripper struct {
	isDsHealthy bool
}

func (fakeRoundTripper *FakeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	var res *http.Response
	if fakeRoundTripper.isDsHealthy {
		res = &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(bytes.NewBufferString("{\"status\":\"green\"}")),
		}
	} else {
		res = &http.Response{
			StatusCode: http.StatusRequestTimeout,
			Status:     "408 Request Timeout",
			Body:       io.NopCloser(bytes.NewBufferString("{\"status\":\"red\"}")),
		}
	}
	return res, nil
}

type FakeInstanceManager struct {
	isDsHealthy bool
}

func (fakeInstanceManager *FakeInstanceManager) Get(tx context.Context, pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	httpClient, _ := httpclient.New(httpclient.Options{})
	httpClient.Transport = &FakeRoundTripper{isDsHealthy: fakeInstanceManager.isDsHealthy}

	return es.DatasourceInfo{
		HTTPClient: httpClient,
	}, nil
}

func (*FakeInstanceManager) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func GetMockService(isDsHealthy bool) *Service {
	return &Service{
		im:     &FakeInstanceManager{isDsHealthy: isDsHealthy},
		logger: log.New(),
	}
}

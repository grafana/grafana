package elasticsearch

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
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
	assert.Equal(t, "Elasticsearch cluster is healthy", res.Message)
}

func Test_Healthcheck_Timeout(t *testing.T) {
	service := GetMockService(false)
	res, _ := service.CheckHealth(context.Background(), &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{},
		Headers:       nil,
	})
	assert.Equal(t, backend.HealthStatusError, res.Status)
	assert.Equal(t, "Elasticsearch cluster is not healthy", res.Message)
}

type FakeRoundTripper struct {
	isClusterHealthy bool
}

func (fakeRoundTripper *FakeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	var res *http.Response
	if fakeRoundTripper.isClusterHealthy {
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
	isClusterHealthy bool
}

func (fakeInstanceManager *FakeInstanceManager) Get(tx context.Context, pluginContext backend.PluginContext) (instancemgmt.Instance, error) {
	httpClient, _ := sdkhttpclient.New(sdkhttpclient.Options{})
	httpClient.Transport = &FakeRoundTripper{isClusterHealthy: fakeInstanceManager.isClusterHealthy}

	return es.DatasourceInfo{
		HTTPClient: httpClient,
	}, nil
}

func (*FakeInstanceManager) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func GetMockService(isClusterHealthy bool) *Service {
	return &Service{
		im: &FakeInstanceManager{isClusterHealthy: isClusterHealthy},
	}
}

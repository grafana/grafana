package zipkin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type ZipkinClient struct {
	logger     log.Logger
	url        string
	httpClient *http.Client
}

func New(url string, hc *http.Client, logger log.Logger) (ZipkinClient, error) {
	client := ZipkinClient{
		logger:     logger,
		url:        url,
		httpClient: hc,
	}
	return client, nil
}

// Services returns list of services
// https://zipkin.io/zipkin-api/#/default/get_services
func (z *ZipkinClient) Services() ([]string, error) {
	services := []string{}
	u, err := url.JoinPath(z.url, "/api/v2/services")
	if err != nil {
		return services, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}
	res, err := z.httpClient.Get(u)
	if err != nil {
		return services, err
	}
	if err := json.NewDecoder(res.Body).Decode(&services); err != nil {
		return services, err
	}
	return services, err
}

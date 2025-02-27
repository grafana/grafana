package jaeger

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type JaegerClient struct {
	logger     log.Logger
	url        string
	httpClient *http.Client
}

type ServicesResponse struct {
	Data   []string    `json:"data"`
	Errors interface{} `json:"errors"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
	Total  int         `json:"total"`
}

func New(url string, hc *http.Client, logger log.Logger) (JaegerClient, error) {
	client := JaegerClient{
		logger:     logger,
		url:        url,
		httpClient: hc,
	}
	return client, nil
}

func (j *JaegerClient) Services() ([]string, error) {
	var response ServicesResponse
	services := []string{}

	u, err := url.JoinPath(j.url, "/api/services")
	if err != nil {
		return services, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	res, err := j.httpClient.Get(u)
	if err != nil {
		return services, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return services, err
	}

	services = response.Data
	return services, err
}

func (j *JaegerClient) Operations(s string) ([]string, error) {
	var response ServicesResponse
	operations := []string{}

	u, err := url.JoinPath(j.url, "/api/services/", s, "/operations")
	if err != nil {
		return operations, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	res, err := j.httpClient.Get(u)
	if err != nil {
		return operations, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return operations, err
	}

	operations = response.Data
	return operations, err
}

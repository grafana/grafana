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
	settings   backend.DataSourceInstanceSettings
}

type ServicesResponse struct {
	Data   []string    `json:"data"`
	Errors interface{} `json:"errors"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
	Total  int         `json:"total"`
}

func New(url string, hc *http.Client, logger log.Logger, settings backend.DataSourceInstanceSettings) (JaegerClient, error) {
	client := JaegerClient{
		logger:     logger,
		url:        url,
		httpClient: hc,
		settings:   settings,
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

func (j *JaegerClient) Search(query *jaegerQuery) (jaegerResponse, error) {
	jaegerURL, err := url.Parse(j.url)
	if err != nil {
		return jaegerResponse{}, fmt.Errorf("failed to parse Jaeger URL: %w", err)
	}
	jaegerURL.Path = "/api/traces"

	queryParams := map[string]string{
		"service":     query.Service,
		"operation":   query.Operation,
		"tags":        query.Tags,
		"minDuration": query.MinDuration,
		"maxDuration": query.MaxDuration,
	}

	urlQuery := jaegerURL.Query()
	if query.Limit > 0 {
		urlQuery.Set("limit", fmt.Sprintf("%d", query.Limit))
	}

	for key, value := range queryParams {
		if value != "" {
			urlQuery.Set(key, value)
		}
	}

	jaegerURL.RawQuery = urlQuery.Encode()
	resp, err := j.httpClient.Get(jaegerURL.String())
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return jaegerResponse{}, backend.DownstreamError(err)
		}
		return jaegerResponse{}, err
	}

	defer func() {
		if err = resp.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", resp.Status))
		if backend.ErrorSourceFromHTTPStatus(resp.StatusCode) == backend.ErrorSourceDownstream {
			return jaegerResponse{}, backend.DownstreamError(err)
		}
		return jaegerResponse{}, err
	}

	var result jaegerResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return jaegerResponse{}, fmt.Errorf("failed to decode Jaeger response: %w", err)
	}

	return result, nil
}

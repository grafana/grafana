package jaeger

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (j *JaegerClient) GrpcServices() ([]string, error) {
	var response GrpcServicesResponse
	services := []string{}

	u, err := url.JoinPath(j.url, "/api/v3/services")
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

	if res != nil && res.StatusCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return services, backend.DownstreamError(err)
		}
		return services, err
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return services, err
	}

	services = response.Services
	return services, nil
}

func (j *JaegerClient) GrpcOperations(s string) ([]string, error) {
	var response GrpcOperationsResponse
	operations := []string{}

	u, err := url.JoinPath(j.url, "/api/v3/operations")
	if err != nil {
		return operations, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	jaegerURL, err := url.Parse(u)
	if err != nil {
		return operations, backend.DownstreamError(fmt.Errorf("failed to parse Jaeger URL: %w", err))
	}

	urlQuery := jaegerURL.Query()
	urlQuery.Set("service", s)
	jaegerURL.RawQuery = urlQuery.Encode()

	res, err := j.httpClient.Get(jaegerURL.String())
	if err != nil {
		return operations, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res != nil && res.StatusCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return operations, backend.DownstreamError(err)
		}
		return operations, err
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return operations, err
	}

	// extract name from operations response
	for _, op := range response.Operations {
		operations = append(operations, op.Name)
	}

	return operations, nil
}

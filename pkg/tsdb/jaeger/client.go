package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type JaegerClient struct {
	logger             log.Logger
	url                string
	httpClient         *http.Client
	traceIdTimeEnabled bool
}

type ServicesResponse struct {
	Data   []string    `json:"data"`
	Errors interface{} `json:"errors"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
	Total  int         `json:"total"`
}

type DependenciesResponse struct {
	Data   []ServiceDependency `json:"data"`
	Errors []struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	} `json:"errors"`
}

type ServiceDependency struct {
	Parent    string `json:"parent"`
	Child     string `json:"child"`
	CallCount int    `json:"callCount"`
}

func New(url string, hc *http.Client, logger log.Logger, traceIdTimeEnabled bool) (JaegerClient, error) {
	client := JaegerClient{
		logger:             logger,
		url:                url,
		httpClient:         hc,
		traceIdTimeEnabled: traceIdTimeEnabled,
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

func (j *JaegerClient) Trace(ctx context.Context, traceID string, start, end int64) (TraceResponse, error) {
	logger := j.logger.FromContext(ctx)
	var response TracesResponse
	trace := TraceResponse{}

	if traceID == "" {
		return trace, backend.DownstreamError(fmt.Errorf("traceID is empty"))
	}

	traceUrl, err := url.JoinPath(j.url, "/api/traces", url.QueryEscape(traceID))
	if err != nil {
		return trace, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	// Add time parameters if provided and traceIdTimeEnabled is true
	if j.traceIdTimeEnabled {
		if start > 0 || end > 0 {
			parsedURL, err := url.Parse(traceUrl)
			if err != nil {
				return trace, backend.DownstreamError(fmt.Errorf("failed to parse url: %w", err))
			}

			query := parsedURL.Query()
			if start > 0 {
				query.Set("start", fmt.Sprintf("%d", start))
			}
			if end > 0 {
				query.Set("end", fmt.Sprintf("%d", end))
			}

			parsedURL.RawQuery = query.Encode()
			traceUrl = parsedURL.String()
		}
	}

	res, err := j.httpClient.Get(traceUrl)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return trace, backend.DownstreamError(err)
		}
		return trace, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res != nil && res.StatusCode/100 != 2 {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return trace, backend.DownstreamError(err)
		}
		return trace, err
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return trace, err
	}

	// We only support one trace at a time
	// this is how it was implemented in the frontend before
	trace = response.Data[0]
	return trace, err
}

func (j *JaegerClient) Dependencies(ctx context.Context, start, end int64) (DependenciesResponse, error) {
	logger := j.logger.FromContext(ctx)
	var dependencies DependenciesResponse

	u, err := url.JoinPath(j.url, "/api/dependencies")
	if err != nil {
		return dependencies, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	// Add time parameters
	parsedURL, err := url.Parse(u)
	if err != nil {
		return dependencies, backend.DownstreamError(fmt.Errorf("failed to parse url: %w", err))
	}

	query := parsedURL.Query()
	if end > 0 {
		query.Set("endTs", fmt.Sprintf("%d", end))
	}
	if start > 0 {
		lookback := end - start
		query.Set("lookback", fmt.Sprintf("%d", lookback))
	}

	parsedURL.RawQuery = query.Encode()
	u = parsedURL.String()

	res, err := j.httpClient.Get(u)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return dependencies, backend.DownstreamError(err)
		}
		return dependencies, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res != nil && res.StatusCode/100 != 2 {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return dependencies, backend.DownstreamError(err)
		}
		return dependencies, err
	}

	if err := json.NewDecoder(res.Body).Decode(&dependencies); err != nil {
		return dependencies, err
	}

	return dependencies, nil
}

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

type TraceKeyValuePair struct {
	Key   string      `json:"key"`
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

type TraceProcess struct {
	ServiceName string              `json:"serviceName"`
	Tags        []TraceKeyValuePair `json:"tags"`
}

type TraceSpanReference struct {
	RefType string `json:"refType"`
	SpanID  string `json:"spanID"`
	TraceID string `json:"traceID"`
}

type TraceLog struct {
	// Millisecond epoch time
	Timestamp int64               `json:"timestamp"`
	Fields    []TraceKeyValuePair `json:"fields"`
	Name      string              `json:"name"`
}

type Span struct {
	TraceID       string `json:"traceID"`
	SpanID        string `json:"spanID"`
	ProcessID     string `json:"processID"`
	OperationName string `json:"operationName"`
	// Times are in microseconds
	StartTime   int64                `json:"startTime"`
	Duration    int64                `json:"duration"`
	Logs        []TraceLog           `json:"logs"`
	References  []TraceSpanReference `json:"references"`
	Tags        []TraceKeyValuePair  `json:"tags"`
	Warnings    []string             `json:"warnings"`
	Flags       int                  `json:"flags"`
	StackTraces []string             `json:"stackTraces"`
}

type TraceResponse struct {
	Processes map[string]TraceProcess `json:"processes"`
	TraceID   string                  `json:"traceID"`
	Warnings  []string                `json:"warnings"`
	Spans     []Span                  `json:"spans"`
}

type TracesResponse struct {
	Data   []TraceResponse `json:"data"`
	Errors interface{}     `json:"errors"` // TODO: Handle errors, but we were not using it in the frontend
	Limit  int             `json:"limit"`
	Offset int             `json:"offset"`
	Total  int             `json:"total"`
}

func (j *JaegerClient) Trace(traceID string, start, end int64) (TraceResponse, error) {
	var response TracesResponse
	trace := TraceResponse{}

	if traceID == "" {
		return trace, backend.DownstreamError(fmt.Errorf("traceID is empty"))
	}

	traceUrl, err := url.JoinPath(j.url, "/api/traces", url.QueryEscape(traceID))
	if err != nil {
		return trace, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	// Add time parameters if provided
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

	res, err := j.httpClient.Get(traceUrl)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return trace, backend.DownstreamError(err)
		}
		return trace, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
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

	trace = response.Data[0]
	return trace, err
}

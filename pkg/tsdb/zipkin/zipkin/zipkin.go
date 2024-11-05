package zipkin

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/openzipkin/zipkin-go/model"

	"github.com/grafana/grafana/pkg/infra/log"
)

type ZipkinClient struct {
	logger     *log.ConcreteLogger
	url        string
	httpClient *http.Client
}

func New(url string, hc *http.Client, logger *log.ConcreteLogger) (ZipkinClient, error) {
	client := ZipkinClient{
		logger:     logger,
		url:        url,
		httpClient: hc,
	}
	if client.httpClient == nil {
		client.httpClient = http.DefaultClient
	}
	if client.logger == nil {
		client.logger = log.New("tsdb.zipkin")
	}
	return client, nil
}

// Services returns list of services
// https://zipkin.io/zipkin-api/#/default/get_services
func (z *ZipkinClient) Services() ([]string, error) {
	services := []string{}
	res, err := z.httpClient.Get(fmt.Sprintf("%s/api/v2/services", z.url))
	if err != nil {
		return services, err
	}
	if err := json.NewDecoder(res.Body).Decode(&services); err != nil {
		return services, err
	}
	return services, err
}

// Spans returns list of spans for the given service
// https://zipkin.io/zipkin-api/#/default/get_spans
func (z *ZipkinClient) Spans(serviceName string) ([]string, error) {
	spans := []string{}
	if serviceName == "" {
		return spans, errors.New("invalid/empty serviceName")
	}
	res, err := z.httpClient.Get(fmt.Sprintf("%s/api/v2/spans?serviceName=%s", z.url, url.QueryEscape(serviceName)))
	if err != nil {
		return spans, err
	}
	if err := json.NewDecoder(res.Body).Decode(&spans); err != nil {
		return spans, err
	}
	return spans, err
}

// Traces returns list of traces for the given service and span
// https://zipkin.io/zipkin-api/#/default/get_traces
func (z *ZipkinClient) Traces(serviceName string, spanName string) ([][]model.SpanModel, error) {
	traces := [][]model.SpanModel{}
	if serviceName == "" {
		return traces, errors.New("invalid/empty serviceName")
	}
	if spanName == "" {
		return traces, errors.New("invalid/empty spanName")
	}
	res, err := z.httpClient.Get(fmt.Sprintf("%s/api/v2/traces?serviceName=%s&spanName=%s", z.url, url.QueryEscape(serviceName), url.QueryEscape(spanName)))
	if err != nil {
		return traces, err
	}
	if err := json.NewDecoder(res.Body).Decode(&traces); err != nil {
		return traces, err
	}
	return traces, err
}

// Trace returns trace for the given traceId
// https://zipkin.io/zipkin-api/#/default/get_trace__traceId_
func (z *ZipkinClient) Trace(traceId string) ([]model.SpanModel, error) {
	trace := []model.SpanModel{}
	if traceId == "" {
		return trace, errors.New("invalid/empty traceId")
	}
	res, err := z.httpClient.Get(fmt.Sprintf("%s/api/v2/trace/%s", z.url, url.QueryEscape(traceId)))
	if err != nil {
		return trace, err
	}
	if err := json.NewDecoder(res.Body).Decode(&trace); err != nil {
		return trace, err
	}
	return trace, err
}

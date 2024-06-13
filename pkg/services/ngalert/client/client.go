package client

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Requester executes an HTTP request.
type Requester interface {
	Do(req *http.Request) (*http.Response, error)
}

// TimedClient instruments a request with metrics. It implements Requester.
type TimedClient struct {
	client    Requester
	collector instrument.Collector
}

type contextKey int

// OperationNameContextKey specifies the operation name location within the context
// for instrumentation.
const OperationNameContextKey contextKey = 0

// NewTimedClient creates a Requester that instruments requests on `client`.
func NewTimedClient(client Requester, collector instrument.Collector) *TimedClient {
	return &TimedClient{
		client:    client,
		collector: collector,
	}
}

// Do executes the request.
func (c TimedClient) Do(r *http.Request) (*http.Response, error) {
	return TimeRequest(r.Context(), c.operationName(r), c.collector, c.client, r)
}

// RoundTrip implements the RoundTripper interface.
func (c TimedClient) RoundTrip(r *http.Request) (*http.Response, error) {
	return c.Do(r)
}

func (c TimedClient) operationName(r *http.Request) string {
	operation, _ := r.Context().Value(OperationNameContextKey).(string)
	if operation == "" {
		operation = r.URL.Path
	}
	return operation
}

// TimeRequest performs an HTTP client request and records the duration in a histogram.
func TimeRequest(ctx context.Context, operation string, coll instrument.Collector, client Requester, request *http.Request) (*http.Response, error) {
	var response *http.Response
	doRequest := func(_ context.Context) error {
		var err error
		response, err = client.Do(request) // nolint:bodyclose
		return err
	}
	toStatusCode := func(err error) string {
		if err == nil {
			return strconv.Itoa(response.StatusCode)
		}
		return "error"
	}
	err := instrument.CollectedRequest(ctx, fmt.Sprintf("%s %s", request.Method, operation),
		coll, toStatusCode, doRequest)
	return response, err
}

// TracedClient instruments a request with tracing. It implements Requester.
type TracedClient struct {
	client Requester
	tracer tracing.Tracer
}

func NewTracedClient(client Requester, tracer tracing.Tracer) *TracedClient {
	return &TracedClient{
		client: client,
		tracer: tracer,
	}
}

// Do executes the request.
func (c TracedClient) Do(r *http.Request) (*http.Response, error) {
	url := r.URL.Path
	method := r.Method
	name := fmt.Sprintf("HTTP %s %s", method, url)
	ctx, span := c.tracer.Start(r.Context(), name, trace.WithAttributes(
		attribute.String("http.method", method),
		attribute.String("http.url", url),
	))
	defer span.End()

	c.tracer.Inject(ctx, r.Header, span)

	r = r.WithContext(ctx)
	resp, err := c.client.Do(r)
	if err != nil {
		span.RecordError(err)
	} else {
		span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))
		if resp.StatusCode >= 400 && resp.StatusCode < 600 {
			span.RecordError(fmt.Errorf("request failed with status code: %d", resp.StatusCode))
		}
	}

	return resp, err
}

// RoundTrip implements the RoundTripper interface.
func (c TracedClient) RoundTrip(r *http.Request) (*http.Response, error) {
	return c.Do(r)
}

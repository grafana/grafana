package client

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
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
	name   string
}

func NewTracedClient(client Requester, tracer tracing.Tracer, name string) *TracedClient {
	return &TracedClient{
		client: client,
		tracer: tracer,
		name:   name,
	}
}

// Do executes the request.
func (c TracedClient) Do(r *http.Request) (*http.Response, error) {
	ctx, span := c.tracer.Start(r.Context(), c.name, trace.WithSpanKind(trace.SpanKindClient))
	defer span.End()

	span.SetAttributes(semconv.HTTPURL(r.URL.String()))
	span.SetAttributes(semconv.HTTPMethod(r.Method))

	c.tracer.Inject(ctx, r.Header, span)

	r = r.WithContext(ctx)
	resp, err := c.client.Do(r)
	if err != nil {
		span.SetStatus(codes.Error, "request failed")
		span.RecordError(err)
	} else {
		if resp.ContentLength > 0 {
			span.SetAttributes(attribute.Int64("http.content_length", resp.ContentLength))
		}
		span.SetAttributes(semconv.HTTPStatusCode(resp.StatusCode))
		if resp.StatusCode >= 400 && resp.StatusCode < 600 {
			span.RecordError(fmt.Errorf("error with HTTP status code %d", resp.StatusCode))
		}
	}

	return resp, err
}

// RoundTrip implements the RoundTripper interface.
func (c TracedClient) RoundTrip(r *http.Request) (*http.Response, error) {
	return c.Do(r)
}

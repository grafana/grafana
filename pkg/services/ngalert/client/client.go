package client

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/dskit/instrument"
)

// Requester executes an HTTP request.
type Requester interface {
	Do(req *http.Request) (*http.Response, error)
}

// TimedClient instruments a request. It implements Requester.
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

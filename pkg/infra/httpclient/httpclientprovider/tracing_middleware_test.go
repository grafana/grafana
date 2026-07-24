package httpclientprovider

import (
	"bytes"
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTracingMiddleware(t *testing.T) {
	tracer := tracing.InitializeTracerForTest()

	t.Run("GET request that returns 200 OK should start and capture span", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Request: req}, nil
		})

		mw := TracingMiddleware(log.New("test"), tracer)
		rt := mw.CreateMiddleware(httpclient.Options{
			Labels: map[string]string{
				"l1": "v1",
				"l2": "v2",
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, TracingMiddlewareName, middlewareName.MiddlewareName())

		ctx := context.Background()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		_, sp := tracer.Start(ctx, "test")
		require.NotNil(t, sp)
	})

	t.Run("GET request that returns 200 OK should propagate parent span", func(t *testing.T) {
		expectedTraceID := "<unset>"

		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			// both Jaeger and w3c headers should be set
			require.NotEmpty(t, req.Header.Get("Uber-Trace-Id"))
			require.NotEmpty(t, req.Header.Get("Traceparent"))

			ctx, span := tracer.Start(req.Context(), "inner")
			defer span.End()

			// child span should have the same trace ID as the parent span
			require.Equal(t, expectedTraceID, tracing.TraceIDFromContext(ctx, false))

			return &http.Response{StatusCode: http.StatusOK, Request: req}, nil
		})

		mw := TracingMiddleware(log.New("test"), tracer)
		rt := mw.CreateMiddleware(httpclient.Options{
			Labels: map[string]string{
				"l1": "v1",
				"l2": "v2",
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, TracingMiddlewareName, middlewareName.MiddlewareName())

		ctx, span := tracer.Start(context.Background(), "testspan")
		defer span.End()

		expectedTraceID = tracing.TraceIDFromContext(ctx, false)
		assert.NotEmpty(t, expectedTraceID)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}
	})

	t.Run("GET request that returns 400 Bad Request should start and capture span", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusBadRequest, Request: req}, nil
		})

		mw := TracingMiddleware(log.New("test"), tracer)
		rt := mw.CreateMiddleware(httpclient.Options{
			Labels: map[string]string{
				"l1": "v1",
				"l2": "v2",
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, TracingMiddlewareName, middlewareName.MiddlewareName())

		ctx := context.Background()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://test.com/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		_, sp := tracer.Start(res.Request.Context(), "test")
		require.NotNil(t, sp)
	})

	t.Run("POST request that returns 200 OK should start and capture span", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Request: req, ContentLength: 10}, nil
		})

		mw := TracingMiddleware(log.New("test"), tracer)
		rt := mw.CreateMiddleware(httpclient.Options{
			Labels: map[string]string{
				"l1": "v1",
				"l2": "v2",
			},
		}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, TracingMiddlewareName, middlewareName.MiddlewareName())

		ctx := context.Background()
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://test.com/query", bytes.NewBufferString("{ \"message\": \"ok\"}"))
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.NotNil(t, res)
		if res.Body != nil {
			require.NoError(t, res.Body.Close())
		}

		_, sp := tracer.Start(res.Request.Context(), "test")
		require.NotNil(t, sp)
	})
}

package httpclientprovider

import (
	"bytes"
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/stretchr/testify/require"
	jaeger "github.com/uber/jaeger-client-go"
)

func TestTracingMiddleware(t *testing.T) {
	setupTracing(t)

	t.Run("GET request that returns 200 OK should start and capture span", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Request: req}, nil
		})

		mw := TracingMiddleware(log.New("test"))
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

		sp := opentracing.SpanFromContext(res.Request.Context())
		require.NotNil(t, sp)
		jsp, ok := sp.(*jaeger.Span)
		require.True(t, ok)
		require.Equal(t, "HTTP Outgoing Request", jsp.OperationName())
		require.Len(t, jsp.Tags(), 8)
		expectedTags := opentracing.Tags{
			string(ext.HTTPMethod):     http.MethodGet,
			string(ext.HTTPStatusCode): uint16(http.StatusOK),
			string(ext.HTTPUrl):        "http://test.com/query",
			"l1":                       "v1",
			"l2":                       "v2",
			jaeger.SamplerParamTagKey:  true,
			jaeger.SamplerTypeTagKey:   jaeger.SamplerTypeConst,
			string(ext.SpanKind):       ext.SpanKindRPCClientEnum,
		}
		require.EqualValues(t, expectedTags, jsp.Tags())
		require.Contains(t, req.Header, "Uber-Trace-Id")
	})

	t.Run("GET request that returns 400 Bad Request should start and capture span", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusBadRequest, Request: req}, nil
		})

		mw := TracingMiddleware(log.New("test"))
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

		sp := opentracing.SpanFromContext(res.Request.Context())
		require.NotNil(t, sp)
		jsp, ok := sp.(*jaeger.Span)
		require.True(t, ok)
		require.Equal(t, "HTTP Outgoing Request", jsp.OperationName())
		require.Len(t, jsp.Tags(), 9)
		expectedTags := opentracing.Tags{
			string(ext.Error):          true,
			string(ext.HTTPMethod):     http.MethodGet,
			string(ext.HTTPStatusCode): uint16(http.StatusBadRequest),
			string(ext.HTTPUrl):        "http://test.com/query",
			"l1":                       "v1",
			"l2":                       "v2",
			jaeger.SamplerParamTagKey:  true,
			jaeger.SamplerTypeTagKey:   jaeger.SamplerTypeConst,
			string(ext.SpanKind):       ext.SpanKindRPCClientEnum,
		}
		require.EqualValues(t, expectedTags, jsp.Tags())
		require.Contains(t, req.Header, "Uber-Trace-Id")
	})

	t.Run("POST request that returns 200 OK should start and capture span", func(t *testing.T) {
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK, Request: req, ContentLength: 10}, nil
		})

		mw := TracingMiddleware(log.New("test"))
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

		sp := opentracing.SpanFromContext(res.Request.Context())
		require.NotNil(t, sp)
		jsp, ok := sp.(*jaeger.Span)
		require.True(t, ok)
		require.Equal(t, "HTTP Outgoing Request", jsp.OperationName())
		require.Len(t, jsp.Tags(), 9)
		expectedTags := opentracing.Tags{
			httpContentLengthTagKey:    int64(10),
			string(ext.HTTPMethod):     http.MethodPost,
			string(ext.HTTPStatusCode): uint16(http.StatusOK),
			string(ext.HTTPUrl):        "http://test.com/query",
			"l1":                       "v1",
			"l2":                       "v2",
			jaeger.SamplerParamTagKey:  true,
			jaeger.SamplerTypeTagKey:   jaeger.SamplerTypeConst,
			string(ext.SpanKind):       ext.SpanKindRPCClientEnum,
		}
		require.EqualValues(t, expectedTags, jsp.Tags())
		require.Contains(t, req.Header, "Uber-Trace-Id")
	})
}

func setupTracing(t *testing.T) {
	t.Helper()

	tracer, closer := jaeger.NewTracer("test", jaeger.NewConstSampler(true), jaeger.NewNullReporter())
	opentracing.SetGlobalTracer(tracer)
	t.Cleanup(func() {
		require.NoError(t, closer.Close())
		opentracing.SetGlobalTracer(opentracing.NoopTracer{})
	})
}

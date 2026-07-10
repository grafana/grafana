package clientmiddleware

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

func TestHTTPCaptureMiddleware_noBuffer_doesNotSetHeader(t *testing.T) {
	var gotHeader string
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		gotHeader = req.Headers[harCaptureHeader]
		return &backend.QueryDataResponse{}, nil
	}

	_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.Empty(t, gotHeader)
}

func TestHTTPCaptureMiddleware_withBuffer_setsGRPCHeader(t *testing.T) {
	var gotHeader string
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		gotHeader = req.Headers[harCaptureHeader]
		return &backend.QueryDataResponse{}, nil
	}

	ctx, _ := harcapture.WithCapture(context.Background())
	_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.Equal(t, "true", gotHeader)
}

func TestHTTPCaptureMiddleware_withBuffer_injectsContextualMiddleware(t *testing.T) {
	var contextualMWs []sdkhttpclient.Middleware
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(ctx context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		contextualMWs = sdkhttpclient.ContextualMiddlewareFromContext(ctx)
		return &backend.QueryDataResponse{}, nil
	}

	ctx, _ := harcapture.WithCapture(context.Background())
	_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.NotEmpty(t, contextualMWs)
}

func TestHTTPCaptureMiddleware_withBuffer_capturesHTTPEntry(t *testing.T) {
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(ctx context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		makeGrafanaHTTPCall(ctx, t, "http://example.com", nil)
		return &backend.QueryDataResponse{}, nil
	}

	ctx, buf := harcapture.WithCapture(context.Background())
	_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.Equal(t, 1, buf.Len())
}

func TestHTTPCaptureMiddleware_withBuffer_capturesFailedRequest(t *testing.T) {
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(ctx context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		// Transport-level failure: RoundTrip returns an error and a nil response.
		makeGrafanaHTTPCall(ctx, t, "http://example.com", errors.New("connection refused"))
		return &backend.QueryDataResponse{}, nil
	}

	ctx, buf := harcapture.WithCapture(context.Background())
	_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.Equal(t, 1, buf.Len(), "failed requests must still be captured in the HAR")
}

func TestHTTPCaptureMiddleware_capturesAndRestoresRequestBody(t *testing.T) {
	var transportSawBody string
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(ctx context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		rt := buildContextualRT(ctx, sdkhttpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			b, _ := io.ReadAll(r.Body) // the transport must still see the full body
			transportSawBody = string(b)
			return okHTTPResp(), nil
		}))
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://example.com", bytes.NewBufferString("payload"))
		_, err := rt.RoundTrip(req) //nolint:bodyclose
		require.NoError(t, err)
		return &backend.QueryDataResponse{}, nil
	}

	ctx, buf := harcapture.WithCapture(context.Background())
	_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{})
	require.NoError(t, err)
	assert.Equal(t, "payload", transportSawBody, "transport receives the full (restored) request body")
	require.Equal(t, 1, buf.Len())
	raw, err := buf.ToHAR()
	require.NoError(t, err)
	assert.Contains(t, string(raw), "payload", "captured request body appears in the HAR")
}

func TestHTTPCaptureMiddleware_requestBodyReadError_failsRequest(t *testing.T) {
	transportCalled := false
	var rtErr error
	cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(NewHTTPCaptureMiddleware()))
	cdt.TestHandler.QueryDataFunc = func(ctx context.Context, _ *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
		rt := buildContextualRT(ctx, sdkhttpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			transportCalled = true
			return okHTTPResp(), nil
		}))
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://example.com", nil)
		req.Body = io.NopCloser(&failingReader{err: errors.New("body boom")})
		_, rtErr = rt.RoundTrip(req) //nolint:bodyclose
		return &backend.QueryDataResponse{}, nil
	}

	ctx, buf := harcapture.WithCapture(context.Background())
	_, err := cdt.MiddlewareHandler.QueryData(ctx, &backend.QueryDataRequest{})
	require.NoError(t, err)
	require.Error(t, rtErr)
	assert.Contains(t, rtErr.Error(), "reading request body")
	assert.False(t, transportCalled, "transport must not be called when the request body cannot be read")
	assert.Equal(t, 0, buf.Len(), "no entry is recorded when the request body read fails")
}

// buildContextualRT wraps base with every contextual middleware registered in ctx (outermost last),
// mirroring how the in-process HTTP client applies them.
func buildContextualRT(ctx context.Context, base http.RoundTripper) http.RoundTripper {
	rt := base
	for _, mw := range sdkhttpclient.ContextualMiddlewareFromContext(ctx) {
		rt = mw.CreateMiddleware(sdkhttpclient.Options{}, rt)
	}
	return rt
}

func okHTTPResp() *http.Response {
	return &http.Response{
		StatusCode: 200,
		Status:     "200 OK",
		Proto:      "HTTP/1.1",
		Header:     http.Header{},
		Body:       io.NopCloser(bytes.NewBufferString("ok")),
	}
}

type failingReader struct{ err error }

func (f *failingReader) Read([]byte) (int, error) { return 0, f.err }

// makeGrafanaHTTPCall simulates an in-process plugin making an HTTP call through the contextual
// middleware chain. When rtErr is non-nil, the simulated transport returns it with a nil response.
func makeGrafanaHTTPCall(ctx context.Context, t *testing.T, url string, rtErr error) {
	t.Helper()
	mws := sdkhttpclient.ContextualMiddlewareFromContext(ctx)
	var rt http.RoundTripper = sdkhttpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
		if rtErr != nil {
			return nil, rtErr
		}
		return &http.Response{
			StatusCode: 200,
			Status:     "200 OK",
			Proto:      "HTTP/1.1",
			Header:     http.Header{},
			Body:       io.NopCloser(bytes.NewBufferString("ok")),
		}, nil
	})
	for _, mw := range mws {
		rt = mw.CreateMiddleware(sdkhttpclient.Options{}, rt)
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	_, _ = rt.RoundTrip(req) //nolint:bodyclose
}

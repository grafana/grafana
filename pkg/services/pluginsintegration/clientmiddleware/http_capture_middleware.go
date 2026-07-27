package clientmiddleware

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

const harCaptureHeader = "X-Grafana-HAR-Capture"

// NewHTTPCaptureMiddleware creates a backend.HandlerMiddleware that captures HTTP traffic
// for QueryData calls when a harcapture.Buffer is present in the context.
//
// For core (in-process) plugins: injects a capturing RoundTripper as contextual middleware
// so the existing ContextualMiddleware in the HTTP client chain picks it up.
//
// For external gRPC plugins: sets X-Grafana-HAR-Capture on the request headers. NOTE: this is
// currently inert — the SDK-side middleware that reads this header and emits __har__ response frames
// is not released yet, so out-of-process plugin traffic is NOT captured until Grafana is bumped to
// an SDK version that includes it. The header is set now only for forward compatibility.
func NewHTTPCaptureMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &HTTPCaptureMiddleware{BaseHandler: backend.NewBaseHandler(next)}
	})
}

type HTTPCaptureMiddleware struct {
	backend.BaseHandler
}

func (m *HTTPCaptureMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	buf := harcapture.FromContext(ctx)
	if buf == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	// Signal external gRPC plugins via request header.
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}
	req.Headers[harCaptureHeader] = "true"

	// Inject capturing RoundTripper for core (in-process) plugins.
	captureMW := sdkhttpclient.NamedMiddlewareFunc("http-capture", func(_ sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return sdkhttpclient.RoundTripperFunc(func(r *http.Request) (*http.Response, error) {
			// Buffer the request body before it is consumed by the transport.
			var bodyBytes []byte
			if r.Body != nil {
				var readErr error
				bodyBytes, readErr = io.ReadAll(r.Body)
				_ = r.Body.Close()
				if readErr != nil {
					// Fail the request rather than silently forwarding a truncated body to the
					// datasource; the diagnostics run surfaces the error.
					return nil, fmt.Errorf("har capture: reading request body: %w", readErr)
				}
				r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			}

			started := time.Now()
			resp, err := next.RoundTrip(r)
			elapsed := time.Since(started)

			// Capture every attempt, including transport-level failures (connection refused,
			// timeouts, etc.) where err is non-nil and resp is nil -- those are exactly the
			// requests worth seeing in a diagnostics bundle. Restore the request body first so
			// buildEntry can read it.
			r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			buf.AddEntry(r, resp, err, started, elapsed)

			return resp, err
		})
	})
	ctx = sdkhttpclient.WithContextualMiddleware(ctx, captureMW)

	return m.BaseHandler.QueryData(ctx, req)
}

package clientmiddleware

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/query"
)

// NewTracingHeaderMiddleware creates a new backend.HandlerMiddleware that will
// populate useful tracing headers on outgoing backend.Handler and HTTP
// requests.
// Tracing headers are X-Datasource-Uid, X-Dashboard-Uid,
// X-Panel-Id, X-Grafana-Org-Id.
func NewTracingHeaderMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &TracingHeaderMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type TracingHeaderMiddleware struct {
	backend.BaseHandler
}

func (m *TracingHeaderMiddleware) applyHeaders(ctx context.Context, req backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// If no HTTP request context then skip middleware.
	if req == nil || reqCtx == nil || reqCtx.Req == nil {
		return
	}

	var headersList = []string{
		query.HeaderQueryGroupID,
		query.HeaderPanelID,
		query.HeaderDashboardUID,
		query.HeaderDatasourceUID,
		query.HeaderFromExpression,
		`X-Grafana-Org-Id`,
		query.HeaderPanelPluginId,
		query.HeaderDashboardTitle,
		query.HeaderPanelTitle,
	}

	for _, headerName := range headersList {
		gotVal := reqCtx.Req.Header.Get(headerName)
		if gotVal == "" {
			continue
		}
		if !isGRPCSafeHeaderValue(gotVal) {
			gotVal = sanitizeHTTPHeaderValueForGRPC(gotVal)
		}
		req.SetHTTPHeader(headerName, gotVal)
	}
}

func (m *TracingHeaderMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *TracingHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req != nil {
		m.applyHeaders(ctx, req)
	}
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *TracingHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *TracingHeaderMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.SubscribeStream(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *TracingHeaderMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.PublishStream(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *TracingHeaderMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return m.BaseHandler.RunStream(ctx, req, sender)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.RunStream(ctx, req, sender)
}

// isGRPCSafeHeaderValue reports whether every byte in s is a printable ASCII
// character (0x20–0x7E), which is the range allowed in gRPC metadata values.
func isGRPCSafeHeaderValue(s string) bool {
	for i := 0; i < len(s); i++ {
		b := s[i]
		if b < 0x20 || b > 0x7E {
			return false
		}
	}
	return true
}

// sanitizeHTTPHeaderValueForGRPC sanitizes header values according to HTTP/2 gRPC specification.
// The spec defines that header values must consist of printable ASCII characters 0x20 (space) - 0x7E(tilde) inclusive.
//
// If the value is already valid UTF-8, any bytes outside the printable ASCII range are
// percent-encoded directly (e.g. é as UTF-8 0xC3 0xA9 → %C3%A9).
//
// If the value is NOT valid UTF-8 (e.g. a raw ISO-8859-1 byte stream as sent by some
// browsers), it is first decoded from ISO-8859-1 to UTF-8 and then percent-encoded,
// producing the same %C3%A9 representation for é.
func sanitizeHTTPHeaderValueForGRPC(value string) string {
	var input []byte
	if utf8.ValidString(value) {
		// Already valid UTF-8: percent-encode non-printable-ASCII bytes directly.
		input = []byte(value)
	} else {
		// Not valid UTF-8: assume ISO-8859-1 (Latin-1) bytes sent by the browser.
		// Convert to UTF-8 first so the percent-encoded output is consistent.
		decoder := charmap.ISO8859_1.NewDecoder()
		decoded, _, err := transform.Bytes(decoder, []byte(value))
		if err != nil {
			decoded = []byte(value)
		}
		input = decoded
	}

	var sanitized strings.Builder
	sanitized.Grow(len(input))
	for _, b := range input {
		if b >= 0x20 && b <= 0x7E {
			sanitized.WriteByte(b)
		} else {
			fmt.Fprintf(&sanitized, "%%%02X", b)
		}
	}
	return sanitized.String()
}

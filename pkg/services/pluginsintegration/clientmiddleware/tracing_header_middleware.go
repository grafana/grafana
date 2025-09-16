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
		if !utf8.ValidString(gotVal) {
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

// sanitizeHTTPHeaderValueForGRPC sanitizes header values according to HTTP/2 gRPC specification.
// The spec defines that header values must consist of printable ASCII characters 0x20 (space) - 0x7E(tilde) inclusive.
// First attempts to decode any percent-encoded characters, then encodes invalid characters.
func sanitizeHTTPHeaderValueForGRPC(value string) string {
	// First try to decode characters that were encoded by the frontend
	decoder := charmap.ISO8859_1.NewDecoder()
	decoded, _, err := transform.Bytes(decoder, []byte(value))
	// If decoding fails, work with the original value
	if err != nil {
		decoded = []byte(value)
	}
	var sanitized strings.Builder
	sanitized.Grow(len(decoded)) // Pre-allocate reasonable capacity
	// Then encode invalid characters
	for _, b := range decoded {
		if b >= 0x20 && b <= 0x7E {
			sanitized.WriteByte(b)
		} else {
			sanitized.WriteString(fmt.Sprintf("%%%02X", b))
		}
	}

	return sanitized.String()
}

package client

import (
	"context"
	"errors"
	"net/http"
	"net/textproto"
	"strings"

	grpccodes "google.golang.org/grpc/codes"
	grpcstatus "google.golang.org/grpc/status"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

const (
	setCookieHeaderName   = "Set-Cookie"
	contentTypeHeaderName = "Content-Type"
	defaultContentType    = "application/json"
)

var _ plugins.Client = (*Service)(nil)

var (
	errNilRequest = errors.New("req cannot be nil")
	errNilSender  = errors.New("sender cannot be nil")
)

// passthroughErrors contains a list of errors that should be returned directly to the caller without wrapping
var passthroughErrors = []error{
	plugins.ErrPluginUnavailable,
	plugins.ErrMethodNotImplemented,
	plugins.ErrPluginGrpcResourceExhaustedBase,
}

type Service struct {
	pluginRegistry registry.Service
}

func ProvideService(pluginRegistry registry.Service) *Service {
	return &Service{
		pluginRegistry: pluginRegistry,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	resp, err := p.QueryData(ctx, req)
	if err != nil {
		for _, e := range passthroughErrors {
			if errors.Is(err, e) {
				return nil, err
			}
		}

		// If the error is a plugin grpc connection unavailable error, return it directly
		// This error is created dynamically based on the context, so we need to check for it here
		if errors.Is(err, plugins.ErrPluginGrpcConnectionUnavailableBaseFn(ctx)) {
			return nil, err
		}

		if errors.Is(err, context.Canceled) {
			return nil, plugins.ErrPluginRequestCanceledErrorBase.Errorf("client: query data request canceled: %w", err)
		}

		if s, ok := grpcstatus.FromError(err); ok && s.Code() == grpccodes.Canceled {
			return nil, plugins.ErrPluginRequestCanceledErrorBase.Errorf("client: query data request canceled: %w", err)
		}

		return nil, plugins.ErrPluginRequestFailureErrorBase.Errorf("client: failed to query data: %w", err)
	}

	for refID, res := range resp.Responses {
		// set frame ref ID based on response ref ID
		for _, f := range res.Frames {
			if f.RefID == "" {
				f.RefID = refID
			}
		}
	}

	return resp, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return errNilRequest
	}

	if sender == nil {
		return errNilSender
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return plugins.ErrPluginNotRegistered
	}

	removeConnectionHeaders(req.Headers)
	removeHopByHopHeaders(req.Headers)
	removeNonAllowedHeaders(req.Headers)

	processedStreams := 0
	wrappedSender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		// Expected that headers and status are only part of first stream
		if processedStreams == 0 && res != nil {
			if len(res.Headers) > 0 {
				removeConnectionHeaders(res.Headers)
				removeHopByHopHeaders(res.Headers)
				removeNonAllowedHeaders(res.Headers)
			} else {
				res.Headers = map[string][]string{}
			}

			proxyutil.SetProxyResponseHeaders(res.Headers)
			ensureContentTypeHeader(res)
		}

		processedStreams++
		return sender.Send(res)
	})

	err := p.CallResource(ctx, req, wrappedSender)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return plugins.ErrPluginRequestCanceledErrorBase.Errorf("client: call resource request canceled: %w", err)
		}

		return plugins.ErrPluginRequestFailureErrorBase.Errorf("client: failed to call resources: %w", err)
	}

	return nil
}

func (s *Service) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	resp, err := p.CollectMetrics(ctx, req)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil, plugins.ErrPluginRequestCanceledErrorBase.Errorf("client: collect metrics request canceled: %w", err)
		}

		return nil, plugins.ErrPluginRequestFailureErrorBase.Errorf("client: failed to collect metrics: %w", err)
	}

	return resp, nil
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	resp, err := p.CheckHealth(ctx, req)
	if err != nil {
		if errors.Is(err, plugins.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, plugins.ErrPluginUnavailable) {
			return nil, err
		}

		if errors.Is(err, context.Canceled) {
			return nil, plugins.ErrPluginRequestCanceledErrorBase.Errorf("client: check health request canceled: %w", err)
		}

		return nil, plugins.ErrPluginHealthCheck.Errorf("client: failed to check health: %w", err)
	}

	return resp, nil
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	return plugin.SubscribeStream(ctx, req)
}

func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	return plugin.PublishStream(ctx, req)
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return errNilRequest
	}

	if sender == nil {
		return errNilSender
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return plugins.ErrPluginNotRegistered
	}

	return plugin.RunStream(ctx, req, sender)
}

// ConvertObject implements plugins.Client.
func (s *Service) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	return plugin.ConvertObjects(ctx, req)
}

// MutateAdmission implements plugins.Client.
func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	return plugin.MutateAdmission(ctx, req)
}

// ValidateAdmission implements plugins.Client.
func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID, req.PluginContext.PluginVersion)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered
	}

	return plugin.ValidateAdmission(ctx, req)
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID, pluginVersion string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID, pluginVersion)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

// removeConnectionHeaders removes hop-by-hop headers listed in the "Connection" header of h.
// See RFC 7230, section 6.1
//
// Based on https://github.com/golang/go/blob/dc04f3ba1f25313bc9c97e728620206c235db9ee/src/net/http/httputil/reverseproxy.go#L411-L421
func removeConnectionHeaders(h map[string][]string) {
	for _, f := range h["Connection"] {
		for _, sf := range strings.Split(f, ",") {
			if sf = textproto.TrimString(sf); sf != "" {
				for k := range h {
					if textproto.CanonicalMIMEHeaderKey(sf) == textproto.CanonicalMIMEHeaderKey(k) {
						delete(h, k)
						break
					}
				}
			}
		}
	}
}

// Hop-by-hop headers. These are removed when sent to the backend.
// As of RFC 7230, hop-by-hop headers are required to appear in the
// Connection header field. These are the headers defined by the
// obsoleted RFC 2616 (section 13.5.1) and are used for backward
// compatibility.
//
// Copied from https://github.com/golang/go/blob/dc04f3ba1f25313bc9c97e728620206c235db9ee/src/net/http/httputil/reverseproxy.go#L171-L186
var hopHeaders = []string{
	"Connection",
	"Proxy-Connection", // non-standard but still sent by libcurl and rejected by e.g. google
	"Keep-Alive",
	"Proxy-Authenticate",
	"Proxy-Authorization",
	"Te",      // canonicalized version of "TE"
	"Trailer", // not Trailers per URL above; https://www.rfc-editor.org/errata_search.php?eid=4522
	"Transfer-Encoding",
	"Upgrade",
	"User-Agent",
}

// removeHopByHopHeaders removes hop-by-hop headers. Especially
// important is "Connection" because we want a persistent
// connection, regardless of what the client sent to us.
//
// Based on https://github.com/golang/go/blob/dc04f3ba1f25313bc9c97e728620206c235db9ee/src/net/http/httputil/reverseproxy.go#L276-L281
func removeHopByHopHeaders(h map[string][]string) {
	for _, hh := range hopHeaders {
		for k := range h {
			if hh == textproto.CanonicalMIMEHeaderKey(k) {
				delete(h, k)
				break
			}
		}
	}
}

func removeNonAllowedHeaders(h map[string][]string) {
	for k := range h {
		if textproto.CanonicalMIMEHeaderKey(k) == setCookieHeaderName {
			delete(h, k)
		}
	}
}

// ensureContentTypeHeader makes sure a content type always is returned in response.
func ensureContentTypeHeader(res *backend.CallResourceResponse) {
	if res == nil {
		return
	}

	var hasContentType bool
	for k := range res.Headers {
		if textproto.CanonicalMIMEHeaderKey(k) == contentTypeHeaderName {
			hasContentType = true
			break
		}
	}

	if !hasContentType && res.Status != http.StatusNoContent {
		res.Headers[contentTypeHeaderName] = []string{defaultContentType}
	}
}

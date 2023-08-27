package client

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/textproto"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
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

type Service struct {
	pluginRegistry registry.Service
	cfg            *config.Cfg
}

func ProvideService(pluginRegistry registry.Service, cfg *config.Cfg) *Service {
	return &Service{
		pluginRegistry: pluginRegistry,
		cfg:            cfg,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered.Errorf("%w", backendplugin.ErrPluginNotRegistered)
	}

	var totalBytes float64
	for _, v := range req.Queries {
		totalBytes += float64(len(v.JSON))
	}

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(ctx, &req.PluginContext, instrumentation.Cfg{
		LogDatasourceRequests: s.cfg.LogDatasourceRequests,
		Target:                p.Target(),
	}, totalBytes, func() (innerErr error) {
		resp, innerErr = p.QueryData(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, plugins.ErrMethodNotImplemented.Errorf("%w", backendplugin.ErrMethodNotImplemented)
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, plugins.ErrPluginUnavailable.Errorf("%w", backendplugin.ErrPluginUnavailable)
		}

		return nil, plugins.ErrPluginDownstreamError.Errorf("%v: %w", "failed to query data", err)
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

	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	totalBytes := float64(len(req.Body))
	err := instrumentation.InstrumentCallResourceRequest(ctx, &req.PluginContext, instrumentation.Cfg{
		LogDatasourceRequests: s.cfg.LogDatasourceRequests,
		Target:                p.Target(),
	}, totalBytes, func() error {
		removeConnectionHeaders(req.Headers)
		removeHopByHopHeaders(req.Headers)
		removeNonAllowedHeaders(req.Headers)

		processedStreams := 0
		wrappedSender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
			// Expected that headers and status are only part of first stream
			if processedStreams == 0 && res != nil {
				if len(res.Headers) > 0 {
					removeConnectionHeaders(res.Headers)
					removeHopByHopHeaders(res.Headers)
					removeNonAllowedHeaders(res.Headers)
				}

				ensureContentTypeHeader(res)
			}

			processedStreams++
			return sender.Send(res)
		})

		if err := p.CallResource(ctx, req, wrappedSender); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func (s *Service) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CollectMetricsResult
	err := instrumentation.InstrumentCollectMetrics(ctx, &req.PluginContext, instrumentation.Cfg{
		LogDatasourceRequests: s.cfg.LogDatasourceRequests,
		Target:                p.Target(),
	}, func() (innerErr error) {
		resp, innerErr = p.CollectMetrics(ctx, req)
		return
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return nil, errNilRequest
	}

	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CheckHealthResult
	err := instrumentation.InstrumentCheckHealthRequest(ctx, &req.PluginContext, instrumentation.Cfg{
		LogDatasourceRequests: s.cfg.LogDatasourceRequests,
		Target:                p.Target(),
	}, func() (innerErr error) {
		resp, innerErr = p.CheckHealth(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, fmt.Errorf("%w: %w", backendplugin.ErrHealthCheckFailed, err)
	}

	return resp, nil
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	return plugin.SubscribeStream(ctx, req)
}

func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return nil, errNilRequest
	}

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
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

	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	return plugin.RunStream(ctx, req, sender)
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID)
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

type callResourceResponseSenderFunc func(res *backend.CallResourceResponse) error

func (fn callResourceResponseSenderFunc) Send(res *backend.CallResourceResponse) error {
	return fn(res)
}

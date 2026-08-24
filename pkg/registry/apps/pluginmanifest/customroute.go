package pluginmanifest

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
)

const maxCustomRouteBodySize = 128 * 1024 * 1024 // 128 MiB

// CallCustomRoute proxies a manifest-declared custom route to the plugin's backend over the gRPC
// CallResource call. The SDK only invokes this for routes the manifest declares, so it is a no-op
// for plugins/kinds without custom routes.
//
// The FULL original request path (req.URL.Path) is forwarded as the CallResource Path, so the
// plugin's resource handler routes on exactly the path that was requested rather than a stripped
// subresource segment.
func (a *pluginBackendApp) CallCustomRoute(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	pluginCtx, err := a.resolvePluginContext(ctx)
	if err != nil {
		return fmt.Errorf("getting plugin context for %s: %w", a.pluginID, err)
	}

	var body []byte
	if req.Body != nil {
		defer func() { _ = req.Body.Close() }()
		body, err = io.ReadAll(http.MaxBytesReader(w, req.Body, maxCustomRouteBodySize))
		if err != nil {
			return fmt.Errorf("reading custom route request body: %w", err)
		}
	}

	crReq := &backend.CallResourceRequest{
		PluginContext: pluginCtx,
		Path:          req.URL.Path,
		Method:        req.Method,
		URL:           req.URL.String(),
		Headers:       req.Headers,
		Body:          body,
	}

	sender := &recordingResponseSender{inner: httpresponsesender.New(w)}
	if err := a.client.CallResource(ctx, crReq, sender); err != nil {
		// If the plugin already started writing the response, returning the error would make the
		// SDK call WriteHeader a second time and corrupt the (possibly streamed) response. Only
		// surface the error when nothing has been written yet.
		if sender.wrote {
			backend.Logger.Error("plugin custom route call failed after response started", "plugin", a.pluginID, "error", err)
			return nil
		}
		return err
	}
	return nil
}

// recordingResponseSender wraps the http response sender and records whether any response has been
// sent, so CallCustomRoute can avoid a double WriteHeader on a late plugin error.
type recordingResponseSender struct {
	inner *httpresponsesender.HTTPResponseSender
	wrote bool
}

func (s *recordingResponseSender) Send(resp *backend.CallResourceResponse) error {
	s.wrote = true
	return s.inner.Send(resp)
}

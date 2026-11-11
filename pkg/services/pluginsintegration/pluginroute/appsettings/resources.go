package appsettings

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// maxResourceBodySize is the largest request body forwarded to the plugin, as
// for the legacy plugin resource endpoint. A variable so tests can lower it.
var maxResourceBodySize int64 = 128 * 1024 * 1024 // 128 MiB

type resourcesHandler struct {
	pluginID        string
	client          backend.CallResourceHandler
	contextProvider func(ctx context.Context) (context.Context, backend.PluginContext, error)
}

func (r *resourcesHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx, pluginCtx, err := r.contextProvider(req.Context())
	if err != nil {
		_ = errhttp.Write(req.Context(), err, w)
		return
	}
	m := newSubresourceMetric("resource", r.pluginID)
	defer m.Record()

	clonedReq, err := resourceRequest(req)
	if err != nil {
		backend.Logger.Error("failed to create resource request", "error", err)
		m.SetError()
		_ = errhttp.Write(req.Context(), err, w)
		return
	}

	proxyutil.PrepareProxyRequest(clonedReq)
	body, err := io.ReadAll(http.MaxBytesReader(w, req.Body, maxResourceBodySize))
	if err != nil {
		m.SetError()
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			_ = errhttp.Write(req.Context(), k8serrors.NewRequestEntityTooLargeError(err.Error()), w)
			return
		}
		backend.Logger.Error("failed to read request body", "error", err)
		_ = errhttp.Write(req.Context(), err, w)
		return
	}

	err = r.client.CallResource(ctx, &backend.CallResourceRequest{
		PluginContext: pluginCtx,
		Path:          clonedReq.URL.Path,
		Method:        req.Method,
		URL:           clonedReq.URL.String(),
		Body:          body,
		Headers:       clonedReq.Header,
	}, httpresponsesender.New(w))

	if err != nil {
		backend.Logger.Error("plugin resource request failed", "error", err)
		m.SetError()
		_ = errhttp.Write(req.Context(), err, w)
		return
	}
}

func resourceRequest(req *http.Request) (*http.Request, error) {
	const slug = "/app/instance/resources"
	idx := strings.Index(req.URL.Path, slug)
	if idx < 0 {
		return nil, fmt.Errorf("expected resources path") // 400?
	}

	clonedReq := req.Clone(req.Context())
	rawURL := strings.TrimLeft(req.URL.Path[idx+len(slug):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}

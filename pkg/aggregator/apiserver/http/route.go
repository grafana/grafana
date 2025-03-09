package http

import (
	"net/http"
	"net/url"
	"path"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"k8s.io/component-base/tracing"
)

func (h *HTTPHandler) RouteHandler(b aggregationv0alpha1.Backend) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		span := tracing.SpanFromContext(req.Context())
		span.AddEvent("RouteHandler")
		location, err := url.Parse(b.BaseURL)
		if err != nil {
			proxyError(w, req, "invalid backend URL", http.StatusInternalServerError)
			return
		}
		location.Path = path.Join(location.Path, req.URL.Path)
		location.RawQuery = req.URL.RawQuery
		h.handlerFor(location).ServeHTTP(w, req)
	})
}

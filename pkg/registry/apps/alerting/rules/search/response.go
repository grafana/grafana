package search

import (
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	appresource "github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/util/errhttp"
)

// HTTPHandler serves a per-kind search route on the generic search endpoint of
// its resource, which mounts plain HTTP handlers. Errors are written with the
// status they carry, as the generic handler writes them.
func HTTPHandler(route simple.AppCustomRouteHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		namespace, _ := request.NamespaceFrom(ctx)
		err := route(ctx, w, &app.CustomRouteRequest{
			ResourceIdentifier: appresource.FullIdentifier{Namespace: namespace},
			URL:                r.URL,
			Method:             r.Method,
			Headers:            r.Header,
			Body:               r.Body,
		})
		if err != nil {
			errhttp.Write(ctx, err, w)
		}
	}
}

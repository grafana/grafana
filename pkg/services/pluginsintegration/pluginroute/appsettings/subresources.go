package appsettings

import (
	"net/http"
	"slices"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// SubresourceHandler serves the health, resources and proxy subresources of the
// settings instance, and passes every other request to next. It must run inside
// the API server's handler chain, which authenticates and authorizes the request
// and adds the request info it dispatches on.
func (b *Builder) SubresourceHandler(next http.Handler) http.Handler {
	handlers := map[string]subresource{
		"health": {methods: []string{http.MethodGet}, handler: &healthHandler{
			group:           b.group,
			client:          b.client,
			contextProvider: b.getPluginContext,
		}},
		"resources": {methods: forwardedMethods, handler: &resourcesHandler{
			pluginID:        b.pluginJSON.ID,
			client:          b.client,
			contextProvider: b.getPluginContext,
		}},
	}
	if b.registersProxy() {
		b.proxy = newProxy(b)
		handlers["proxy"] = subresource{methods: forwardedMethods, handler: b.proxy}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, ok := request.RequestInfoFrom(r.Context())
		// Other versions are not served, so the API server answers them with a 404.
		if !ok || !info.IsResourceRequest || info.APIGroup != b.group || info.APIVersion != apppluginV0.VERSION ||
			info.Resource != apppluginV0.APP_RESOURCE_NAME {
			next.ServeHTTP(w, r)
			return
		}
		sub, ok := handlers[info.Subresource]
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		if !slices.Contains(sub.methods, r.Method) {
			w.Header().Set("Allow", strings.Join(sub.methods, ", "))
			_ = errhttp.Write(r.Context(), k8serrors.NewMethodNotSupported(apppluginV0.SettingsResourceInfo.GroupResource(), r.Method), w)
			return
		}
		if info.Name != apppluginV0.INSTANCE_NAME {
			_ = errhttp.Write(r.Context(), k8serrors.NewBadRequest("name can only be: "+apppluginV0.INSTANCE_NAME), w)
			return
		}
		if info.Namespace == "" {
			_ = errhttp.Write(r.Context(), k8serrors.NewBadRequest("missing namespace"), w)
			return
		}
		sub.handler.ServeHTTP(w, r.WithContext(request.WithNamespace(r.Context(), info.Namespace)))
	})
}

type subresource struct {
	methods []string
	handler http.Handler
}

// forwardedMethods are the methods the resources and proxy subresources pass on
// to the plugin. Any other method, such as TRACE or CONNECT, is refused before
// it reaches the plugin or a proxy target.
var forwardedMethods = []string{
	http.MethodGet,
	http.MethodHead,
	http.MethodPost,
	http.MethodPut,
	http.MethodPatch,
	http.MethodDelete,
	http.MethodOptions,
}

// Destroy closes the proxy's idle connections, once the handler no longer serves
// requests.
func (b *Builder) Destroy() {
	if b.proxy != nil {
		b.proxy.pluginProxyTransport.CloseIdleConnections()
	}
}

func (b *Builder) registersProxy() bool {
	return len(b.pluginJSON.Routes) > 0 && b.opts.RegisterProxy
}

package apiserver

import (
	"net/http"
	"sync/atomic"
	"time"

	grafanasemconv "github.com/grafana/grafana/pkg/semconv"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/component-base/tracing"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin"
)

// dataPlaneServiceHandler provides a http.Handler which will proxy traffic to a plugin client.
type dataPlaneServiceHandler struct {
	localDelegate         http.Handler
	client                plugin.PluginClient
	pluginContextProvider plugin.PluginContextProvider
	handlingInfo          atomic.Value
}

type handlingInfo struct {
	name    string
	handler http.Handler
}

func (r *dataPlaneServiceHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	value := r.handlingInfo.Load()
	if value == nil {
		r.localDelegate.ServeHTTP(w, req)
		return
	}
	handlingInfo := value.(handlingInfo)

	namespace, _ := request.NamespaceFrom(req.Context())
	ctx, span := tracing.Start(
		req.Context(),
		"grafana-aggregator",
		grafanasemconv.K8sDataplaneserviceName(handlingInfo.name),
		semconv.K8SNamespaceName(namespace),
		semconv.HTTPMethod(req.Method),
		semconv.HTTPURL(req.URL.String()),
	)
	// log if the span has not ended after a minute
	defer span.End(time.Minute)

	handlingInfo.handler.ServeHTTP(w, req.WithContext(ctx))
}

func (r *dataPlaneServiceHandler) updateDataPlaneService(dataplaneService *aggregationv0alpha1.DataPlaneService) {
	newInfo := handlingInfo{
		name: dataplaneService.Name,
	}

	// currently only plugin handlers are supported
	newInfo.handler = plugin.NewPluginHandler(
		r.client,
		*dataplaneService,
		r.pluginContextProvider,
		r.localDelegate,
	)

	r.handlingInfo.Store(newInfo)
}

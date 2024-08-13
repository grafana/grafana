// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kube-aggregator/blob/master/pkg/apiserver/handler_proxy.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apiserver

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/component-base/tracing"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	grafanasemconv "github.com/grafana/grafana/pkg/semconv"
)

type PluginClient interface {
	backend.QueryDataHandler
	backend.StreamHandler
	backend.AdmissionHandler
	backend.CallResourceHandler
}

type PluginContextProvider interface {
	GetPluginContext(ctx context.Context, pluginID, uid string) (backend.PluginContext, error)
}

// proxyHandler provides a http.Handler which will proxy traffic to a plugin client.
type proxyHandler struct {
	localDelegate         http.Handler
	client                PluginClient
	pluginContextProvider PluginContextProvider
	handlingInfo          atomic.Value
}

type proxyHandlingInfo struct {
	name    string
	handler *pluginHandler
}

func (r *proxyHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	value := r.handlingInfo.Load()
	if value == nil {
		r.localDelegate.ServeHTTP(w, req)
		return
	}
	handlingInfo := value.(proxyHandlingInfo)

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

func (r *proxyHandler) updateDataPlaneService(dataplaneService *aggregationv0alpha1.DataPlaneService) {
	newInfo := proxyHandlingInfo{
		name: dataplaneService.Name,
	}

	newInfo.handler = newPluginHandler(
		r.client,
		*dataplaneService,
		r.pluginContextProvider,
		r.localDelegate,
	)

	r.handlingInfo.Store(newInfo)
}

// responder implements rest.Responder for assisting a connector in writing objects or errors.
type responder struct {
	w http.ResponseWriter
}

// TODO this should properly handle content type negotiation
// if the caller asked for protobuf and you write JSON bad things happen.
func (r *responder) Object(statusCode int, obj runtime.Object) {
	responsewriters.WriteRawJSON(statusCode, obj, r.w)
}

func (r *responder) Error(_ http.ResponseWriter, req *http.Request, err error) {
	tracing.SpanFromContext(req.Context()).RecordError(err)
	s := responsewriters.ErrorToAPIStatus(err)
	r.Object(http.StatusInternalServerError, s)
}

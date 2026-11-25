package pluginroute

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/managedfields"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/handlers"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/metrics"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"
)

type writeEndpointKey struct {
	schema.GroupVersionResource
	subresource string
}

type writeEndpoint struct {
	scope      handlers.RequestScope
	storage    rest.Storage
	admission  admission.Interface
	namespaced bool
	timeout    time.Duration
}

func (b *manifestBuilder) configureWrites(info *genericapiserver.APIGroupInfo, config genericapiserver.Config, equivalents runtime.EquivalentResourceRegistry) error {
	b.writes = make(map[writeEndpointKey]*writeEndpoint)
	for version, resources := range info.VersionedResourcesStorageMap {
		for path, storage := range resources {
			resource, subresource, _ := strings.Cut(path, "/")
			gvr := schema.GroupVersionResource{Group: b.group, Version: version, Resource: resource}
			kind := b.writeKind(gvr)
			if kind == nil || (subresource != "" && subresource != "status") {
				continue
			}
			gvk := gvr.GroupVersion().WithKind(kind.Kind)
			creator := writeObjectCreator{ObjectCreater: info.Scheme, kind: gvk.GroupKind()}
			scope := handlers.RequestScope{
				Namer:      handlers.ContextBasedNaming{Namer: meta.NewAccessor(), ClusterScoped: !b.kinds[gvr].NamespaceScoped()},
				Serializer: info.NegotiatedSerializer, ParameterCodec: info.ParameterCodec,
				Creater: creator, Convertor: info.Scheme, Defaulter: info.Scheme, Typer: info.Scheme,
				UnsafeConvertor: runtime.UnsafeObjectConvertor(info.Scheme), Authorizer: config.Authorization.Authorizer,
				EquivalentResourceMapper: equivalents,
				Resource:                 gvr, Kind: gvk, Subresource: subresource,
				HubGroupVersion:  schema.GroupVersion{Group: b.group, Version: runtime.APIVersionInternal},
				MetaGroupVersion: metav1.SchemeGroupVersion, MaxRequestBodyBytes: config.MaxRequestBodyBytes,
			}
			scope.TableConvertor, _ = storage.(rest.TableConvertor)
			var resetFields map[fieldpath.APIVersion]*fieldpath.Set
			if reset, ok := storage.(rest.ResetFieldsStrategy); ok {
				resetFields = reset.GetResetFields()
			}
			var err error
			scope.FieldManager, err = managedfields.NewDefaultFieldManager(
				managedfields.NewDeducedTypeConverter(), scope.UnsafeConvertor, scope.Defaulter, creator,
				gvk, scope.HubGroupVersion, subresource, fieldpath.NewExcludeFilterSetMap(resetFields))
			if err != nil {
				return fmt.Errorf("field manager for %s: %w", gvr, err)
			}
			// Native create/update handlers cap writes at 34 seconds. Conversion
			// must share that deadline even though Decode has no context argument.
			timeout := 34 * time.Second
			if config.RequestTimeout > 0 {
				timeout = min(timeout, config.RequestTimeout)
			}
			b.writes[writeEndpointKey{gvr, subresource}] = &writeEndpoint{
				scope: scope, storage: storage, admission: config.AdmissionControl,
				namespaced: b.kinds[gvr].NamespaceScoped(), timeout: timeout,
			}
		}
	}
	return nil
}

func (b *manifestBuilder) serveWrites(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, ok := request.RequestInfoFrom(r.Context())
		// RequestInfo also calls POST /things/search a create. Match only the
		// resource paths, leaving collection routes and PATCH to their handlers.
		if !ok || !info.IsResourceRequest ||
			!(info.Verb == "create" && info.Name == "" && len(info.Parts) == 1 ||
				info.Verb == "update" && info.Name != "" && (len(info.Parts) == 2 || len(info.Parts) == 3 && info.Subresource == "status")) {
			next.ServeHTTP(w, r)
			return
		}
		gvr := schema.GroupVersionResource{Group: info.APIGroup, Version: info.APIVersion, Resource: info.Resource}
		endpoint := b.writes[writeEndpointKey{gvr, info.Subresource}]
		if endpoint == nil || endpoint.namespaced != (info.Namespace != "") {
			next.ServeHTTP(w, r)
			return
		}
		ctx := request.WithNamespace(r.Context(), info.Namespace)
		if endpoint.timeout > 0 {
			var cancel context.CancelFunc
			ctx, cancel = context.WithTimeout(ctx, endpoint.timeout)
			defer cancel()
		}
		r = r.WithContext(ctx)
		serializer := &writeSerializer{
			NegotiatedSerializer: endpoint.scope.Serializer, builder: b, ctx: ctx,
			gvr: gvr, namespace: info.Namespace, validation: r.URL.Query().Get("fieldValidation"),
		}
		// Native handlers have no request-context argument on their decoder.
		// Only this copy captures the caller; the shared scope stays immutable.
		scope := endpoint.scope
		scope.Serializer = serializer
		var handler http.HandlerFunc
		if info.Verb == "create" {
			handler = handlers.CreateResource(endpoint.storage.(rest.Creater), &scope, endpoint.admission)
		} else {
			handler = handlers.UpdateResource(endpoint.storage.(rest.Updater), &scope, endpoint.admission)
		}
		write := func(w http.ResponseWriter, r *http.Request) {
			handler(&conversionErrorWriter{ResponseWriter: w, serializer: serializer}, r)
			if serializer.conversionErr != nil {
				responsewriters.ErrorNegotiated(serializer.conversionErr, serializer.NegotiatedSerializer, gvr.GroupVersion(), w, r)
			}
		}
		metricScope := "cluster"
		if endpoint.namespaced {
			metricScope = "namespace"
		}
		metrics.InstrumentHandlerFunc(r.Method, gvr.Group, gvr.Version, gvr.Resource,
			info.Subresource, metricScope, metrics.APIServerComponent, false, "", write)(w, r)
	})
}

type writeObjectCreator struct {
	runtime.ObjectCreater
	kind schema.GroupKind
}

func (c writeObjectCreator) New(gvk schema.GroupVersionKind) (runtime.Object, error) {
	if gvk.GroupKind() == c.kind {
		// Field management needs the empty live object to carry its version.
		obj := &unstructured.Unstructured{}
		obj.SetGroupVersionKind(gvk)
		return obj, nil
	}
	return c.ObjectCreater.New(gvk)
}

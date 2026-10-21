package pluginroute

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/sets"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	"k8s.io/apiserver/pkg/endpoints/request"
	genericfilters "k8s.io/apiserver/pkg/server/filters"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/filters"
	apiserverauthenticator "github.com/grafana/grafana/pkg/services/apiserver/auth/authenticator"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// hasKinds reports whether any served version of a manifest declares a kind.
func hasKinds(manifest *app.ManifestData) bool {
	for _, version := range manifest.Versions {
		if version.Served && len(version.Kinds) > 0 {
			return true
		}
	}
	return false
}

// newRoutesOnlyHandler serves a manifest that declares no kinds. With nothing to
// store there is no API server to build: the manifest's routes, the group's
// discovery documents and its OpenAPI documents are all there is.
//
// It runs the API server's own filters, in the order DefaultBuildHandlerChain
// does, with the same authorizer, so callers see the same decisions, errors,
// timeouts and cache headers as from a full handler. The router relies on the
// private Cache-Control header: it is what keeps a plugin's OpenAPI document
// from being served from cache to a caller who has lost access. Flow control,
// CORS, HSTS and the shutdown filters are left out, since this handler is never
// served on its own listener.
func newRoutesOnlyHandler(b *manifestBuilder, reg prometheus.Registerer) (*Handler, error) {
	authz, err := b.unionAuthorizer()
	if err != nil {
		return nil, fmt.Errorf("%s: authorization: %w", b.group, err)
	}

	documents, err := b.versionDocuments(b.GetGroupVersions())
	if err != nil {
		return nil, err
	}
	notFound := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = errhttp.Write(r.Context(), &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusNotFound,
			Reason:  metav1.StatusReasonNotFound,
			Message: "the server could not find the requested resource",
		}}, w)
	})

	scheme := runtime.NewScheme()
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Version: "v1"})
	codecs := serializer.NewCodecFactory(scheme).WithoutConversion()
	resolver := &request.RequestInfoFactory{APIPrefixes: sets.NewString("apis")}

	// The API server's defaults for these.
	longRunning := genericfilters.BasicLongRunningRequestCheck(sets.NewString("watch"), sets.NewString())
	const requestTimeout = 60 * time.Second

	handler := b.routeMux(documents(notFound), reg)
	handler = filters.WithRequester(handler)
	handler = genericapifilters.WithAuthorization(handler, authz, codecs)
	handler = genericapifilters.WithAuthentication(handler, apiserverauthenticator.NewAuthenticator(),
		genericapifilters.Unauthorized(codecs), nil, nil)
	handler = genericapifilters.WithWarningRecorder(handler)
	handler = genericfilters.WithTimeoutForNonLongRunningRequests(handler, longRunning)
	handler = genericapifilters.WithRequestDeadline(handler, nil, nil, longRunning, codecs, requestTimeout)
	handler = genericapifilters.WithCacheControl(handler)
	handler = genericapifilters.WithRequestInfo(handler, resolver)
	handler = genericapifilters.WithRequestReceivedTimestamp(handler)
	handler = genericfilters.WithPanicRecovery(handler, resolver)
	handler = genericapifilters.WithAuditInit(handler)
	return &Handler{Handler: handler, destroy: func() {}}, nil
}

// kindlessVersions are the served versions that declare no kinds. The API
// server has nothing to install for them, so it serves no documents for them.
func (b *manifestBuilder) kindlessVersions() []schema.GroupVersion {
	var out []schema.GroupVersion
	for _, gv := range b.GetGroupVersions() {
		if v := b.servedVersion(gv); v != nil && len(v.Kinds) == 0 {
			out = append(out, gv)
		}
	}
	return out
}

// versionDocuments serves the discovery and OpenAPI documents of versions
// without kinds, and, when there are any, the group document listing every
// served version, which the API server would otherwise list without them.
// Every other request goes to next.
func (b *manifestBuilder) versionDocuments(versions []schema.GroupVersion) (func(next http.Handler) http.Handler, error) {
	if len(versions) == 0 {
		return func(next http.Handler) http.Handler { return next }, nil
	}
	// Looked up by exact path, since this runs ahead of the API server on every
	// request, and a ServeMux lookup costs far more.
	documents := map[string]http.Handler{}
	group := APIGroup(b.manifest)
	group.TypeMeta = metav1.TypeMeta{Kind: "APIGroup", APIVersion: "v1"}
	documents["/apis/"+b.group] = jsonDocument(group)
	for _, gv := range versions {
		documents["/apis/"+gv.String()] = jsonDocument(metav1.APIResourceList{
			TypeMeta:     metav1.TypeMeta{Kind: "APIResourceList", APIVersion: "v1"},
			GroupVersion: gv.String(),
			APIResources: []metav1.APIResource{},
		})
		oas, err := b.routesOnlyOpenAPI(gv)
		if err != nil {
			return nil, fmt.Errorf("%s: openapi: %w", gv, err)
		}
		documents["/openapi/v3/apis/"+gv.String()] = jsonDocument(oas)
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead {
				if document, ok := documents[r.URL.Path]; ok {
					document.ServeHTTP(w, r)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}, nil
}

// routesOnlyOpenAPI builds the OpenAPI document of a version without kinds from
// its routes alone, with the same post-processing as the API server's.
func (b *manifestBuilder) routesOnlyOpenAPI(gv schema.GroupVersion) (*spec3.OpenAPI, error) {
	return b.PostProcessOpenAPI(&spec3.OpenAPI{
		Version: "3.0.0",
		Info: &spec.Info{InfoProps: spec.InfoProps{
			Title:   gv.String(),
			Version: b.opts.BuildVersion,
		}},
		Paths:      &spec3.Paths{Paths: map[string]*spec3.Path{}},
		Components: &spec3.Components{Schemas: map[string]*spec.Schema{}},
	})
}

// jsonDocument serves a document that does not change once built.
func jsonDocument(doc any) http.Handler {
	body, err := json.Marshal(doc)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err != nil {
			_ = errhttp.Write(r.Context(), err, w)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	})
}

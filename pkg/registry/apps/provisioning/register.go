// Package provisioning serves the provisioning API group through the grafana-app-sdk installer.
//
// The installer owns kinds, CRUD, status and subresource routing. The existing APIBuilder stays the
// dependency container: its connectors, admission handler, authorizer and controllers are reused.
package provisioning

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/manifestdata"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningapp "github.com/grafana/grafana/apps/provisioning/pkg/app"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ builder.GroupVersionRoutesProvider = (*AppInstaller)(nil)
)

// AppInstaller serves the provisioning API group via the app-sdk.
type AppInstaller struct {
	appsdkapiserver.AppInstaller
	builder  *provisioningapis.APIBuilder
	builders *provisioningapis.APIBuilders

	scheme *runtime.Scheme
	codecs serializer.CodecFactory
	// legacy holds the builders' storages per version, keyed by "<plural>[/<subresource>]".
	legacy map[string]map[string]rest.Storage
}

// RegisterAppInstaller returns nil when provisioning is not served through the app installer.
func RegisterAppInstaller(cfg *setting.Cfg, builders *provisioningapis.APIBuilders) (*AppInstaller, error) {
	if !cfg.ProvisioningEnabled || builders == nil {
		return nil, nil
	}
	b := builders.V0Alpha1

	i := &AppInstaller{builder: b, builders: builders, legacy: map[string]map[string]rest.Storage{}}
	manifest := provisioningapp.WithRoutes(*manifestdata.LocalManifest().ManifestData)
	provider := simple.NewAppProvider(sdkapp.NewEmbeddedManifest(manifest), nil, i.newApp)
	inner, err := appsdkapiserver.NewDefaultAppInstaller(provider, sdkapp.Config{
		KubeConfig:   clientrest.Config{}, // overridden by InitializeApp
		ManifestData: manifest,
	}, provisioningapp.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	i.AppInstaller = inner
	return i, nil
}

func (i *AppInstaller) newApp(cfg sdkapp.Config) (sdkapp.App, error) {
	var kinds []simple.AppManagedKind
	for _, version := range provisioningapp.Versions {
		for _, kind := range provisioningapp.Kinds(version) {
			routes := simple.AppCustomRouteHandlers{}
			for _, r := range provisioningapp.RoutesFor(kind.Kind()) {
				for _, method := range r.Methods {
					routes[simple.AppCustomRoute{Method: simple.AppCustomRouteMethod(method), Path: r.Path}] = i.connectorRoute(kind.Plural() + "/" + r.Path)
				}
			}
			kinds = append(kinds, simple.AppManagedKind{Kind: kind, CustomRoutes: routes})
		}
	}

	a, err := simple.NewApp(simple.AppConfig{
		Name:         provisioningapp.AppName,
		KubeConfig:   cfg.KubeConfig,
		ManagedKinds: kinds,
	})
	if err != nil {
		return nil, err
	}
	a.AddRunnable(&postStartHooks{builder: i.builder, kubeConfig: cfg.KubeConfig})
	return a, nil
}

// GroupVersionRoutes mounts the builders' own HTTP routes (stats, settings) and post-processes each version's OpenAPI.
func (i *AppInstaller) GroupVersionRoutes() []builder.GroupVersionRoutes {
	out := make([]builder.GroupVersionRoutes, 0, 2)
	for _, b := range []*provisioningapis.APIBuilder{i.builders.V0Alpha1, i.builders.V1Beta1} {
		gv := b.GetGroupVersion()
		out = append(out, builder.GroupVersionRoutes{
			GroupVersion: gv,
			Routes:       b.GetAPIRoutes(gv),
			PostProcess:  b.PostProcessOpenAPI,
		})
	}
	return out
}

// GetAuthorizer reuses the builder's authorizer.
func (i *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return i.builder.GetAuthorizer()
}

// AddToScheme records the scheme: the builder needs it to build the connectors' backing stores.
func (i *AppInstaller) AddToScheme(scheme *runtime.Scheme) error {
	if err := i.AppInstaller.AddToScheme(scheme); err != nil {
		return err
	}
	// The installer only registers kinds; connectors also return subresource types.
	for _, gv := range append(i.GroupVersions(), provisioning.InternalGroupVersion) {
		if err := provisioning.AddKnownTypes(gv, scheme); err != nil {
			return err
		}
	}
	i.scheme = scheme
	i.codecs = serializer.NewCodecFactory(scheme)
	return nil
}

// GetOpenAPIDefinitions serves the definitions generated for the hand-written types
// instead of deriving them from (absent) manifest kind schemas.
func (i *AppInstaller) GetOpenAPIDefinitions(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
	defs := i.builder.GetOpenAPIDefinitions()(ref)
	for k, v := range i.builders.V1Beta1.GetOpenAPIDefinitions()(ref) {
		defs[k] = v
	}
	for k, v := range appsdkapiserver.GetResourceCallOptionsOpenAPIDefinition() {
		defs[k] = v
	}
	defs["com.github.grafana.grafana.pkg.apiserver.appsdk.EmptyObject"] = common.OpenAPIDefinition{
		Schema: spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}},
	}
	return defs
}

// InstallAPIs lets the builders construct their storages, then installs the app's APIs with the
// subresources routed through the app's custom route handlers.
func (i *AppInstaller) InstallAPIs(server appsdkapiserver.GenericAPIServer, optsGetter genericregistry.RESTOptionsGetter) error {
	for version, b := range map[string]*provisioningapis.APIBuilder{
		provisioning.VERSION:        i.builders.V0Alpha1,
		provisioningapp.VersionBeta: i.builders.V1Beta1,
	} {
		info := genericapiserver.NewDefaultAPIGroupInfo(provisioning.GROUP, i.scheme, runtime.NewParameterCodec(i.scheme), serializer.NewCodecFactory(i.scheme))
		if err := b.UpdateAPIGroupInfo(&info, builder.APIGroupOptions{Scheme: i.scheme, OptsGetter: optsGetter}); err != nil {
			return fmt.Errorf("build provisioning storage for %s: %w", version, err)
		}
		i.legacy[version] = info.VersionedResourcesStorageMap[version]
	}
	return i.AppInstaller.InstallAPIs(&subpathServer{
		GenericAPIServer:   server,
		legacy:             i.legacy,
		storesHistoricJobs: i.builder.StoresHistoricJobs(),
	}, optsGetter)
}

// AdmissionPlugin delegates to the builder's admission handler, which already knows every kind.
func (i *AppInstaller) AdmissionPlugin() admission.Factory {
	return func(io.Reader) (admission.Interface, error) {
		return &admissionPlugin{builder: i.builder}, nil
	}
}

type admissionPlugin struct {
	builder *provisioningapis.APIBuilder
}

var (
	_ admission.MutationInterface   = (*admissionPlugin)(nil)
	_ admission.ValidationInterface = (*admissionPlugin)(nil)
)

func (p *admissionPlugin) Handles(admission.Operation) bool { return true }

func (p *admissionPlugin) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetResource().Group != provisioning.GROUP {
		return nil
	}
	return p.builder.Mutate(ctx, a, o)
}

func (p *admissionPlugin) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetResource().Group != provisioning.GROUP {
		return nil
	}
	return p.builder.Validate(ctx, a, o)
}

// connectorRoute adapts a legacy rest.Connecter to an app custom route handler.
func (i *AppInstaller) connectorRoute(key string) simple.AppCustomRouteHandler {
	return func(ctx context.Context, w sdkapp.CustomRouteResponseWriter, req *sdkapp.CustomRouteRequest) error {
		connector, ok := i.legacy[req.ResourceIdentifier.Version][key].(rest.Connecter)
		if !ok {
			return apierrors.NewNotFound(schema.GroupResource{Group: provisioning.GROUP, Resource: key}, req.ResourceIdentifier.Name)
		}
		ctx = request.WithNamespace(ctx, req.ResourceIdentifier.Namespace)
		responder := &responder{w: w, codecs: i.codecs, gv: schema.GroupVersion{Group: provisioning.GROUP, Version: req.ResourceIdentifier.Version}}
		handler, err := connector.Connect(ctx, req.ResourceIdentifier.Name, nil, responder)
		if err != nil {
			return err
		}
		handler.ServeHTTP(w, httpRequest(ctx, req))
		return responder.err
	}
}

func httpRequest(ctx context.Context, req *sdkapp.CustomRouteRequest) *http.Request {
	r := &http.Request{
		Method:     req.Method,
		URL:        req.URL,
		Header:     req.Headers,
		Body:       req.Body,
		Host:       req.URL.Host,
		RequestURI: req.URL.RequestURI(),
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
	}
	if r.Body == nil {
		r.Body = http.NoBody
	}
	return r.WithContext(ctx)
}

// responder implements rest.Responder for connectors running behind a custom route.
type responder struct {
	w      http.ResponseWriter
	codecs serializer.CodecFactory
	gv     schema.GroupVersion
	err    error
}

// Object encodes with the scheme so the response carries kind and apiVersion.
func (r *responder) Object(statusCode int, obj runtime.Object) {
	info, _ := runtime.SerializerInfoForMediaType(r.codecs.SupportedMediaTypes(), runtime.ContentTypeJSON)
	r.w.Header().Set("Content-Type", runtime.ContentTypeJSON)
	r.w.WriteHeader(statusCode)
	if err := r.codecs.EncoderForVersion(info.Serializer, r.gv).Encode(obj, r.w); err != nil {
		logging.DefaultLogger.Error("failed to encode connector response", "error", err)
	}
}

// Error is deferred to the route handler's return value so the installer writes the status.
func (r *responder) Error(err error) {
	if r.err == nil {
		r.err = err
	}
}

// graftedStores keep the builder's stores: the generic app-sdk store differs on conditional updates of
// missing objects, its status store silently drops bundled spec changes instead of rejecting them, and
// it does not carry the original identity onto the HistoricJobs the provisioning service creates.
var graftedStores = []string{"repositories", "repositories/status", "connections", "connections/status", "historicjobs"}

// subpathServer wraps the generic server to customise the storages the app-sdk builds: it grafts the
// builder's stores, lets subresource connectors that take trailing path segments (files/{path}, history/{uid})
// accept them, and drops HistoricJobs when they are served from Loki.
type subpathServer struct {
	appsdkapiserver.GenericAPIServer
	legacy             map[string]map[string]rest.Storage
	storesHistoricJobs bool
}

func (s *subpathServer) InstallAPIGroup(info *genericapiserver.APIGroupInfo) error {
	for version, storage := range info.VersionedResourcesStorageMap {
		if !s.storesHistoricJobs {
			delete(storage, "historicjobs")
		}
		for _, key := range graftedStores {
			if st, ok := s.legacy[version][key]; ok {
				storage[key] = st
			}
		}
		for key, st := range storage {
			conn, ok := st.(*appsdkapiserver.SubresourceConnector)
			if !ok {
				continue
			}
			route := key[strings.LastIndex(key, "/")+1:]
			for _, r := range provisioningapp.Routes {
				if r.Path == route {
					storage[key] = &routeConnector{SubresourceConnector: conn, route: route, subpath: r.Subpath, kind: kindObject(r)}
				}
			}
		}
	}
	return s.GenericAPIServer.InstallAPIGroup(info)
}

// kindObject is the kind the route reports in the OpenAPI spec, as the builder's connectors did.
func kindObject(r provisioningapp.Route) runtime.Object {
	switch r.Path {
	case "history":
		return &provisioning.HistoryList{} // the response is declared as a string
	case "jobs":
		return &provisioning.Repository{} // jobs is a sub-path of the repository
	}
	if obj, ok := r.Response.(runtime.Object); ok {
		return obj
	}
	return &provisioning.Repository{}
}

// routeConnector reports the route's own kind instead of the generic call options. Subresources that
// take trailing path segments keep the full request URL but dispatch to the handler registered for the bare route.
type routeConnector struct {
	*appsdkapiserver.SubresourceConnector
	route   string
	subpath bool
	kind    runtime.Object
}

func (c *routeConnector) New() runtime.Object { return c.kind.DeepCopyObject() }

func (c *routeConnector) NewConnectOptions() (runtime.Object, bool, string) {
	if !c.subpath {
		return c.SubresourceConnector.NewConnectOptions()
	}
	return &appsdkapiserver.ResourceCallOptions{}, true, ""
}

func (c *routeConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if !c.subpath {
		return c.SubresourceConnector.Connect(ctx, name, opts, responder)
	}
	info, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return nil, errors.New("unable to retrieve request info from context")
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := c.Route.Handler(r.Context(), w, &sdkapp.CustomRouteRequest{
			ResourceIdentifier: resourceIdentifier(info, c.Kind.Kind(), name),
			Path:               c.route,
			URL:                r.URL,
			Method:             r.Method,
			Headers:            r.Header,
			Body:               r.Body,
		})
		if err != nil {
			responder.Error(err)
		}
	}), nil
}

// postStartHooks runs the builder's post start hooks (controllers, usage collection) as an app runnable.
type postStartHooks struct {
	builder    *provisioningapis.APIBuilder
	kubeConfig clientrest.Config
}

func (p *postStartHooks) Run(ctx context.Context) error {
	hooks, err := p.builder.GetPostStartHooks()
	if err != nil {
		return err
	}
	logger := logging.FromContext(ctx)
	for name, hook := range hooks {
		if err := hook(genericapiserver.PostStartHookContext{LoopbackClientConfig: &p.kubeConfig, Context: ctx}); err != nil {
			logger.Error("provisioning post start hook failed", "hook", name, "error", err)
			return fmt.Errorf("post start hook %s: %w", name, err)
		}
	}
	<-ctx.Done()
	return nil
}

func resourceIdentifier(info *request.RequestInfo, kind, name string) resource.FullIdentifier {
	return resource.FullIdentifier{
		Name:      name,
		Namespace: info.Namespace,
		Group:     info.APIGroup,
		Version:   info.APIVersion,
		Kind:      kind,
	}
}

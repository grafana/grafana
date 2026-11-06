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
	genericstore "k8s.io/apiserver/pkg/registry/generic/registry"
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
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ builder.GroupVersionRoutesProvider = (*AppInstaller)(nil)
	_ appinstaller.StorageWrapper        = (*AppInstaller)(nil)
)

// AppInstaller serves the provisioning API group via the app-sdk.
type AppInstaller struct {
	appsdkapiserver.AppInstaller
	builder  *provisioningapis.APIBuilder
	builders *provisioningapis.APIBuilders

	scheme *runtime.Scheme
	codecs serializer.CodecFactory
	routes provisioningapp.RouteTable
	// legacy holds the connectors the builder creates, keyed by "<plural>/<subresource>".
	legacy map[string]rest.Storage
}

// RegisterAppInstaller returns nil when provisioning is not served through the app installer.
func RegisterAppInstaller(cfg *setting.Cfg, builders *provisioningapis.APIBuilders) (*AppInstaller, error) {
	if !cfg.ProvisioningEnabled || builders == nil {
		return nil, nil
	}
	b := builders.V0Alpha1

	routes := provisioningapp.NewRouteTable(b.ExtraSubresourceRoutes()...)
	i := &AppInstaller{builder: b, builders: builders, routes: routes, legacy: map[string]rest.Storage{}}

	manifest := *manifestdata.LocalManifest().ManifestData
	if !b.StoresHistoricJobs() {
		manifest = withoutKind(manifest, provisioningapp.KindHistoric)
	}
	manifest = provisioningapp.WithRoutes(manifest, routes)
	provider := simple.NewAppProvider(sdkapp.NewEmbeddedManifest(manifest), nil, i.newApp)
	inner, err := appsdkapiserver.NewDefaultAppInstaller(provider, sdkapp.Config{
		KubeConfig:   clientrest.Config{}, // overridden by InitializeApp
		ManifestData: manifest,
	}, provisioningapp.GoTypeAssociator{Routes: routes})
	if err != nil {
		return nil, err
	}
	// Same store semantics as the Grafana registry stores the builder used.
	inner.SetStrategyOptions(appsdkapiserver.StrategyOptions{
		AllowCreateOnUpdate:        true,
		AllowUnconditionalUpdate:   true,
		ValidateSpecOnStatusUpdate: true,
		// jobs are created with the status they carry
		ResetStatusOnCreate: func(kind string) bool {
			return kind == provisioningapp.KindRepository || kind == provisioningapp.KindConnection
		},
	})
	i.AppInstaller = inner
	return i, nil
}

// withoutKind drops a kind from every version, e.g. HistoricJobs while job history is kept in Loki.
func withoutKind(m sdkapp.ManifestData, kind string) sdkapp.ManifestData {
	versions := make([]sdkapp.ManifestVersion, len(m.Versions))
	for n, v := range m.Versions {
		kinds := make([]sdkapp.ManifestVersionKind, 0, len(v.Kinds))
		for _, k := range v.Kinds {
			if k.Kind != kind {
				kinds = append(kinds, k)
			}
		}
		v.Kinds = kinds
		versions[n] = v
	}
	m.Versions = versions
	return m
}

func (i *AppInstaller) newApp(cfg sdkapp.Config) (sdkapp.App, error) {
	var kinds []simple.AppManagedKind
	for _, version := range provisioningapp.Versions {
		for _, kind := range provisioningapp.Kinds(version) {
			routes := simple.AppCustomRouteHandlers{}
			for _, r := range i.routes.For(kind.Kind()) {
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
			// both versions use the handlers of the initialised builder; only the OpenAPI is per version
			Routes:      i.builder.GetAPIRoutes(gv),
			PostProcess: b.PostProcessOpenAPI,
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

// InstallAPIs lets the builder construct its connectors, then installs the app's APIs with the
// subresources routed through the app's custom route handlers.
func (i *AppInstaller) InstallAPIs(server appsdkapiserver.GenericAPIServer, optsGetter genericregistry.RESTOptionsGetter) error {
	info := genericapiserver.NewDefaultAPIGroupInfo(provisioning.GROUP, i.scheme, runtime.NewParameterCodec(i.scheme), serializer.NewCodecFactory(i.scheme))
	if err := i.builder.UpdateAPIGroupInfo(&info, builder.APIGroupOptions{Scheme: i.scheme, OptsGetter: optsGetter}); err != nil {
		return fmt.Errorf("build provisioning connectors: %w", err)
	}
	for key, st := range info.VersionedResourcesStorageMap[provisioning.VERSION] {
		if _, ok := st.(rest.Connecter); ok {
			i.legacy[key] = st
		}
	}
	return i.AppInstaller.InstallAPIs(&storageServer{GenericAPIServer: server, routes: i.routes}, optsGetter)
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
		connector, ok := i.legacy[key].(rest.Connecter)
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

type remoteAddrKey struct{}

func httpRequest(ctx context.Context, req *sdkapp.CustomRouteRequest) *http.Request {
	remoteAddr, _ := ctx.Value(remoteAddrKey{}).(string)
	r := &http.Request{
		RemoteAddr: remoteAddr,
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

// tableConverters keep the `kubectl get` columns the builder's stores had.
var tableConverters = map[string]rest.TableConvertor{
	"repositories": provisioning.RepositoryResourceInfo.TableConverter(),
	"connections":  provisioning.ConnectionResourceInfo.TableConverter(),
	"jobs":         provisioning.JobResourceInfo.TableConverter(),
	"historicjobs": provisioning.HistoricJobResourceInfo.TableConverter(),
}

// WrapStorage runs after the server configured the store, which needs to see the plain registry store. It
// carries the original identity onto the HistoricJobs the provisioning service creates, and re-stamps the items
// listed through v1beta1, which shares its Go types with v0alpha1.
func (i *AppInstaller) WrapStorage(gv schema.GroupVersion, gr schema.GroupResource, storage rest.Storage) rest.Storage {
	store, ok := storage.(*genericstore.Store)
	if !ok {
		return storage
	}
	if gv.Version != provisioning.VERSION {
		return grafanaregistry.NewVersionedStore(store, gv)
	}
	if gr.Resource == "historicjobs" {
		return provisioningapis.NewHistoricJobStorage(store)
	}
	return storage
}

// storageServer wraps the generic server to customise the storages the app-sdk builds: it keeps the table
// columns, and lets subresource connectors report their own kind and accept trailing path segments
// (files/{path}, history/{uid}).
type storageServer struct {
	appsdkapiserver.GenericAPIServer
	routes provisioningapp.RouteTable
}

func (s *storageServer) InstallAPIGroup(info *genericapiserver.APIGroupInfo) error {
	for _, storage := range info.VersionedResourcesStorageMap {
		for key, st := range storage {
			switch st := st.(type) {
			case *genericstore.Store:
				if tc, ok := tableConverters[key]; ok {
					st.TableConvertor = tc
				}
			case *appsdkapiserver.SubresourceConnector:
				route := key[strings.LastIndex(key, "/")+1:]
				for _, r := range s.routes {
					if r.Path == route {
						storage[key] = &routeConnector{SubresourceConnector: st, route: route, subpath: r.Subpath, kind: kindObject(r)}
					}
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

// Connect dispatches to the handler registered for the bare route, keeping the full request URL. It passes the
// peer address along, which the custom route request does not carry (webhook rate limiting is per sender).
func (c *routeConnector) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return nil, errors.New("unable to retrieve request info from context")
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := c.Route.Handler(context.WithValue(r.Context(), remoteAddrKey{}, r.RemoteAddr), w, &sdkapp.CustomRouteRequest{
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

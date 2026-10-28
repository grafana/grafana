// Package apiserver runs the production API server with isolated storage for tests.
package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/util/yaml"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/router"
	grafanaserver "github.com/grafana/grafana/pkg/server"
	bootstrapwire "github.com/grafana/grafana/pkg/server/bootstrap/wire"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/aggregatorrunner"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	apirequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

// Options configures dependencies before APIs are registered and started.
// Each call must supply fresh builders and app installers through Register.
type Options struct {
	Configure    func(*setting.Cfg)
	FeatureFlags []string
	Register     func(*Environment)
}

// Environment owns one API server and its database. Register APIs using their
// production constructors and Registrar, just as the application does.
type Environment struct {
	*grafanaserver.APIServices
	Cfg             *setting.Cfg
	DB              db.DB
	Registry        *prometheus.Registry
	Registrar       builder.APIRegistrar
	handler         http.Handler
	featureProvider openfeature.FeatureProvider
}

// Run installs feature evaluation for packages using isolated environments.
// Each environment selects its own immutable flags through request contexts.
func Run(m *testing.M) {
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(nil)
	if err != nil {
		panic(err)
	}
	if err := openfeature.SetProviderAndWait(&environmentFeatureProvider{FeatureProvider: provider}); err != nil {
		panic(err)
	}
	code := m.Run()
	openfeature.Shutdown()
	os.Exit(code)
}

const environmentFeatureProviderName = "grafana-api-integration"

type featureProviderKey struct{}

type environmentFeatureProvider struct {
	openfeature.FeatureProvider
}

func (p *environmentFeatureProvider) Metadata() openfeature.Metadata {
	return openfeature.Metadata{Name: environmentFeatureProviderName}
}

func (p *environmentFeatureProvider) provider(ctx context.Context) openfeature.FeatureProvider {
	if provider, ok := ctx.Value(featureProviderKey{}).(openfeature.FeatureProvider); ok {
		return provider
	}
	return p.FeatureProvider
}

func (p *environmentFeatureProvider) BooleanEvaluation(ctx context.Context, key string, fallback bool, eval openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	return p.provider(ctx).BooleanEvaluation(ctx, key, fallback, eval)
}

func (p *environmentFeatureProvider) StringEvaluation(ctx context.Context, key string, fallback string, eval openfeature.FlattenedContext) openfeature.StringResolutionDetail {
	return p.provider(ctx).StringEvaluation(ctx, key, fallback, eval)
}

func (p *environmentFeatureProvider) IntEvaluation(ctx context.Context, key string, fallback int64, eval openfeature.FlattenedContext) openfeature.IntResolutionDetail {
	return p.provider(ctx).IntEvaluation(ctx, key, fallback, eval)
}

func (p *environmentFeatureProvider) FloatEvaluation(ctx context.Context, key string, fallback float64, eval openfeature.FlattenedContext) openfeature.FloatResolutionDetail {
	return p.provider(ctx).FloatEvaluation(ctx, key, fallback, eval)
}

func (p *environmentFeatureProvider) ObjectEvaluation(ctx context.Context, key string, fallback any, eval openfeature.FlattenedContext) openfeature.InterfaceResolutionDetail {
	return p.provider(ctx).ObjectEvaluation(ctx, key, fallback, eval)
}

func (e *Environment) configureFeatureFlags(t *testing.T, enabled []string) []string {
	t.Helper()
	flags, err := setting.ReadFeatureTogglesFromInitFile(e.Cfg.Raw.Section("feature_toggles"))
	require.NoError(t, err)
	if len(enabled) > 0 || len(flags) > 0 {
		require.Equal(t, environmentFeatureProviderName, openfeature.ProviderMetadata().Name,
			"use apiserver.Run in TestMain; do not replace the provider during parallel tests")
	}
	for _, flag := range enabled {
		flags[flag] = setting.NewInMemoryFlag(flag, true)
		e.Cfg.Raw.Section("feature_toggles").Key(flag).SetValue("true")
	}
	e.featureProvider, err = featuremgmt.CreateStaticProviderWithStandardFlags(flags)
	require.NoError(t, err)
	var legacyFlags []string
	for name, flag := range flags {
		if value, ok := flag.Variants[flag.DefaultVariant].(bool); ok && value {
			legacyFlags = append(legacyFlags, name)
		}
	}
	slices.Sort(legacyFlags)
	return legacyFlags
}

// Context selects this environment's flags for direct service calls.
func (e *Environment) Context(ctx context.Context) context.Context {
	return context.WithValue(ctx, featureProviderKey{}, e.featureProvider)
}

func (e *Environment) withFeatureFlags(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(e.Context(r.Context())))
	})
}

// New starts the API server with production dependencies and isolated SQL storage.
// GRAFANA_TEST_DB selects SQLite, MySQL, or PostgreSQL via db.NewTestStore.
func New(t *testing.T, opts Options) *Environment {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.HomePath = testutil.GrafanaRootDir(t)
	cfg.DataPath = t.TempDir()
	settings, err := ini.Load(filepath.Join(cfg.HomePath, "conf", "defaults.ini"))
	require.NoError(t, err)
	settings.Section("").Key("target").SetValue(modules.GrafanaAPIServer)
	settings.Section("paths").Key("data").SetValue(cfg.DataPath)
	for _, key := range []string{"plugins", "bundled_plugins", "provisioning"} {
		settings.Section("paths").Key(key).SetValue(filepath.Join(cfg.DataPath, key))
	}
	settings.Section("unified_alerting").Key("enabled").SetValue("false")
	settings.Section("rbac").Key("permission_cache").SetValue("false")
	settings.Section("grafana-apiserver").Key("enable_search").SetValue("false")
	settings.Section("plugins").Key("public_key_retrieval_disabled").SetValue("true")
	settings.Section("database").Key("query_retries").SetValue("10")
	settings.Section("database").Key("transaction_retries").SetValue("10")
	require.NoError(t, cfg.ApplySettings(settings))
	cfg.BuildVersion = "0.0.0"
	cfg.DisablePruner = true
	if opts.Configure != nil {
		opts.Configure(cfg)
	}
	env := &Environment{
		Cfg:      cfg,
		Registry: prometheus.NewRegistry(),
	}
	flags := env.configureFeatureFlags(t, opts.FeatureFlags)
	storeDB := db.NewTestStore(t, db.WithCfg(cfg), db.WithFeatureFlags(flags...))
	env.DB = storeDB
	// An empty type selects the resource provider's existing-test-store fallback.
	cfg.Raw.Section("database").Key("type").SetValue("")
	env.APIServices, err = bootstrapwire.InitializeAPIServices(env.Context(t.Context()), cfg, storeDB, env.Registry)
	require.NoError(t, err)
	t.Cleanup(func() {
		env.GRPCServer.GetServer().Stop()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, env.ResourceClient.(resource.ResourceServerStopper).Stop(ctx))
		require.NoError(t, env.HTTPServer.Live.Shutdown(ctx))
		require.NoError(t, env.Tracer.GetTracerProvider().Shutdown(ctx))
	})
	configProvider := env.RestConfigProvider
	eventualResource := env.EventualResource
	routerEngine, err := router.ProvideGrafanaRouter(cfg)
	require.NoError(t, err)
	routesLoader, err := router.ProvideRoutesLoader(cfg, router.PluginLoaderDependencies{})
	require.NoError(t, err)
	requestRouter, err := router.ProvideService(cfg, env.Features, routesLoader, env.Registry, routerEngine)
	require.NoError(t, err)
	buildHandlerChain := func(builders []builder.APIGroupBuilder, reg prometheus.Registerer) builder.BuildHandlerChainFunc {
		chain := builder.GetDefaultBuildHandlerChainFunc(builders, reg)
		return func(handler http.Handler, config *genericapiserver.Config) http.Handler {
			return env.withFeatureFlags(chain(handler, config))
		}
	}
	server, err := grafanaapiserver.ProvideService(cfg, env.Features, env.Routes,
		env.Tracer, env.DB, env.DualWriter, env.ResourceClient, env.InlineSecrets, configProvider, env.AccessClient,
		buildHandlerChain, configProvider,
		eventualResource, env.Registry,
		aggregatorrunner.ProvideNoopAggregatorConfigurator(), grafanaapiserver.ProvideNoopApiExtensionsRunner(),
		nil, builder.ProvideBuilderMetrics(env.Registry), auditing.ProvideNoopBackend(),
		auditing.ProvideNoopPolicyRuleProvider(), requestRouter)
	require.NoError(t, err)
	env.Registrar = server
	if opts.Register != nil {
		opts.Register(env)
	}
	require.NoError(t, env.Permissions.RegisterFixedRoles(env.Context(t.Context())))
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, services.StopAndAwaitTerminated(ctx, server))
	})
	ctx, cancel := context.WithTimeout(env.Context(t.Context()), 30*time.Second)
	defer cancel()
	require.NoError(t, server.StartAsync(env.Context(t.Context())))
	require.NoError(t, server.AwaitRunning(ctx))
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, services.StopAndAwaitTerminated(ctx, requestRouter))
	})
	require.NoError(t, requestRouter.StartAsync(env.Context(t.Context())))
	require.NoError(t, requestRouter.AwaitRunning(ctx))
	loopback, err := server.GetRestConfig(ctx)
	require.NoError(t, err)
	client, err := clientrest.HTTPClientFor(loopback)
	require.NoError(t, err)
	require.NoError(t, wait.PollUntilContextCancel(ctx, 10*time.Millisecond, true, func(ctx context.Context) (bool, error) {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, loopback.Host+"/readyz", nil)
		if err != nil {
			return false, err
		}
		response, err := client.Do(request)
		if err != nil {
			return false, err
		}
		defer response.Body.Close()
		_, err = io.Copy(io.Discard, response.Body)
		return response.StatusCode == http.StatusOK, err
	}))
	mux := web.New()
	mux.UseMiddleware(env.HTTPServer.ContextHandler.Middleware)
	env.Routes.Register(mux)
	env.handler = env.withFeatureFlags(mux)
	return env
}

// ClientConfig authenticates with the fixture's credentials through Grafana's
// production context middleware and API-server HTTP handler chain.
func (e *Environment) ClientConfig(caller User) *clientrest.Config {
	cfg := &clientrest.Config{
		Host:      "http://grafana.test",
		Transport: &options.RoundTripperFunc{Fn: responsewriter.WrapHandler(e.handler)},
	}
	if caller.Identity != nil {
		cfg.Username = caller.Identity.Login
		cfg.Password = string(caller.Password)
	}
	return cfg
}

type User struct {
	Identity *user.SignedInUser
	Password user.Password
}

type OrgUsers struct {
	OrgID  int64
	Admin  User
	Editor User
	Viewer User
	None   User
}

type OrgUsersArgs struct {
	OrgID        int64
	GrafanaAdmin bool
}

// CreateOrgUsers persists role fixtures without granting server-wide privileges
// unless requested. Organization-specific logins permit multiple org fixtures.
func (e *Environment) CreateOrgUsers(t *testing.T, args OrgUsersArgs) OrgUsers {
	t.Helper()
	if args.OrgID == 0 {
		id, err := e.Organizations.GetOrCreate(e.Context(t.Context()), "Main Org.")
		require.NoError(t, err)
		args.OrgID = id
	}
	create := func(name string, role org.RoleType) User {
		caller := e.CreateUser(t, &user.CreateUserCommand{
			Login:          fmt.Sprintf("%s-org-%d", name, args.OrgID),
			Password:       user.Password("test-password"),
			OrgID:          args.OrgID,
			DefaultOrgRole: string(role),
			IsAdmin:        args.GrafanaAdmin && role == org.RoleAdmin,
		})
		require.Equal(t, role, caller.Identity.OrgRole)
		require.Equal(t, args.OrgID, caller.Identity.OrgID)
		require.Equal(t, args.GrafanaAdmin && role == org.RoleAdmin, caller.Identity.IsGrafanaAdmin)
		return caller
	}
	return OrgUsers{
		OrgID:  args.OrgID,
		Admin:  create("admin", org.RoleAdmin),
		Editor: create("editor", org.RoleEditor),
		Viewer: create("viewer", org.RoleViewer),
		None:   create("none", org.RoleNone),
	}
}

// CreateUser persists a user and organization membership using production services.
func (e *Environment) CreateUser(t *testing.T, cmd *user.CreateUserCommand) User {
	t.Helper()
	ctx := e.Context(t.Context())
	if cmd.OrgID == 0 {
		orgID, err := e.Organizations.GetOrCreate(ctx, "Main Org.")
		require.NoError(t, err)
		copy := *cmd
		copy.OrgID = orgID
		cmd = &copy
	}
	ctx = identity.WithServiceIdentityContext(ctx, cmd.OrgID)
	created, err := e.Users.Create(ctx, cmd)
	require.NoError(t, err)
	signedIn, err := e.Users.GetSignedInUser(ctx, &user.GetSignedInUserQuery{
		UserID: created.ID, OrgID: created.OrgID,
	})
	require.NoError(t, err)
	signedIn.Namespace = apirequest.GetNamespaceMapper(e.Cfg)(signedIn.OrgID)
	return User{Identity: signedIn, Password: cmd.Password}
}

// SetPermissions persists scoped grants through the production permission store.
func (e *Environment) SetPermissions(t *testing.T, caller User, permissions []resourcepermissions.SetResourcePermissionCommand) {
	t.Helper()
	store := resourcepermissions.NewStore(e.Cfg, e.DB, e.Features)
	for _, permission := range permissions {
		_, err := store.SetUserResourcePermission(e.Context(t.Context()), caller.Identity.OrgID,
			accesscontrol.User{ID: caller.Identity.UserID}, permission, nil)
		require.NoError(t, err)
	}
}

type ResourceClientArgs struct {
	User      User
	GVR       schema.GroupVersionResource
	Namespace string
}

// GetResourceClient defaults to the authenticated caller's namespace.
func (e *Environment) GetResourceClient(t *testing.T, args ResourceClientArgs) dynamic.ResourceInterface {
	t.Helper()
	client, err := dynamic.NewForConfig(e.ClientConfig(args.User))
	require.NoError(t, err)
	if args.Namespace == "" {
		require.NotNil(t, args.User.Identity, "a caller is required to infer the namespace")
		args.Namespace = args.User.Identity.Namespace
	}
	return client.Resource(args.GVR).Namespace(args.Namespace)
}

type RequestParams struct {
	User   User
	Method string
	Path   string
	Body   []byte
	Accept string
}

type Response[T any] struct {
	Response *http.Response
	Body     []byte
	Result   *T
	Status   *metav1.Status
}

func (e *Environment) List(t *testing.T, caller User, namespace string, gvr schema.GroupVersionResource) Response[unstructured.UnstructuredList] {
	t.Helper()
	return DoRequest(t, e, RequestParams{
		User: caller, Path: fmt.Sprintf("/apis/%s/namespaces/%s/%s", gvr.GroupVersion(), namespace, gvr.Resource),
	}, &unstructured.UnstructuredList{})
}

// DoRequest sends credentials through the same HTTP middleware as API clients.
func DoRequest[T any](t *testing.T, env *Environment, params RequestParams, result *T) Response[T] {
	t.Helper()
	if params.Method == "" {
		params.Method = http.MethodGet
	}
	cfg := env.ClientConfig(params.User)
	client, err := clientrest.HTTPClientFor(cfg)
	require.NoError(t, err)
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	// Cleanup callbacks run after t.Context is canceled and still need HTTP access.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), 30*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(env.Context(ctx), params.Method, cfg.Host+params.Path, bytes.NewReader(params.Body))
	require.NoError(t, err)
	if params.Body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if params.Accept != "" {
		request.Header.Set("Accept", params.Accept)
	}
	rsp, err := client.Do(request)
	require.NoError(t, err)
	defer rsp.Body.Close()
	body, err := io.ReadAll(rsp.Body)
	require.NoError(t, err)
	out := Response[T]{Response: rsp, Body: body, Result: result}
	var status metav1.Status
	if json.Unmarshal(body, &status) == nil && status.Kind == "Status" {
		out.Status, out.Result = &status, nil
	} else if result != nil && len(body) > 0 {
		require.NoError(t, json.Unmarshal(body, result))
	}
	return out
}

func LoadYAMLOrJSONFile(t *testing.T, path string) *unstructured.Unstructured {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	data, err = yaml.ToJSON(data)
	require.NoError(t, err)
	var object unstructured.Unstructured
	require.NoError(t, json.Unmarshal(data, &object))
	return &object
}

// SanitizeJSON replaces generated metadata while preserving resource contents.
func SanitizeJSON(t *testing.T, object *unstructured.Unstructured, replaceMeta ...string) string {
	t.Helper()
	copy := object.DeepCopy()
	copy.SetAnnotations(nil)
	copy.SetManagedFields(nil)
	metadata, ok := copy.Object["metadata"].(map[string]any)
	require.True(t, ok)
	delete(metadata, "generation")
	replaceMeta = append(replaceMeta, "creationTimestamp", "resourceVersion", "uid")
	for _, key := range replaceMeta {
		if key == "labels" {
			delete(metadata, key)
		} else if value, found := metadata[key]; found {
			require.NotEmpty(t, value)
			metadata[key] = fmt.Sprintf("${%s}", key)
		}
	}
	data, err := json.Marshal(copy)
	require.NoError(t, err)
	return string(data)
}

func (e *Environment) GroupVersionInfoJSON(t *testing.T, caller User, group string) (string, error) {
	t.Helper()
	var discovery struct {
		Items []struct {
			Metadata metav1.ObjectMeta `json:"metadata"`
			Versions json.RawMessage   `json:"versions"`
		} `json:"items"`
	}
	response := DoRequest(t, e, RequestParams{
		User: caller, Path: "/apis",
		Accept: "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json",
	}, &discovery)
	if response.Status != nil {
		return "", fmt.Errorf("discovery failed: %s", response.Status.Message)
	}
	for _, item := range discovery.Items {
		if item.Metadata.Name == group {
			return string(item.Versions), nil
		}
	}
	return "", fmt.Errorf("discovery group %q not found", group)
}

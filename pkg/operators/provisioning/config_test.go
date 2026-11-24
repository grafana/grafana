package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/rest"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	storagev0 "github.com/grafana/grafana/pkg/apis/storage/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/router/routertest"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

func TestConnectionFactoryUsesConfiguredTypes(t *testing.T) {
	configuredType := apisprovisioning.ConnectionType("configured")
	extras := make([]connection.Extra, 0, 2)
	for _, connectionType := range []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		configuredType,
	} {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	cfg := ControllerConfig{
		Settings:         &setting.Cfg{ProvisioningConnectionTypes: []string{string(configuredType)}},
		connectionExtras: extras,
		tracer:           tracing.NewNoopTracerService(),
	}
	factory, err := cfg.ConnectionFactory()
	require.NoError(t, err)
	require.ElementsMatch(t, []apisprovisioning.ConnectionType{configuredType}, factory.Types())
}

func TestConnectionFactoryEnablesAllRegisteredTypesByDefault(t *testing.T) {
	registeredTypes := []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		apisprovisioning.GithubEnterpriseConnectionType,
		apisprovisioning.GithubOAuthConnectionType,
		apisprovisioning.GithubEnterpriseOAuthConnectionType,
		apisprovisioning.BitbucketOAuthConnectionType,
		apisprovisioning.GitlabOAuthConnectionType,
		apisprovisioning.GitOAuthConnectionType,
	}
	extras := make([]connection.Extra, 0, len(registeredTypes))
	for _, connectionType := range registeredTypes {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	cfg := ControllerConfig{
		Settings:         &setting.Cfg{},
		connectionExtras: extras,
		tracer:           tracing.NewNoopTracerService(),
	}
	factory, err := cfg.ConnectionFactory()
	require.NoError(t, err)
	require.ElementsMatch(t, registeredTypes, factory.Types())
}

// roundTripperFunc lets a plain function stand in as an http.RoundTripper.
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// TestWrapWithTracing verifies that the typed provisioning client's transport is wrapped
// with otelhttp so Job updates and Repository/Connection status patches propagate trace
// context, and that it composes with (rather than replaces) an existing WrapTransport such
// as the token-exchange wrapper.
func TestWrapWithTracing(t *testing.T) {
	t.Run("wraps a config without an existing transport wrapper", func(t *testing.T) {
		cfg := &rest.Config{}
		wrapWithTracing(cfg)
		require.NotNil(t, cfg.WrapTransport)

		base := roundTripperFunc(func(*http.Request) (*http.Response, error) { return nil, nil })
		_, ok := cfg.WrapTransport(base).(*otelhttp.Transport)
		require.True(t, ok, "expected the outermost transport to be an otelhttp.Transport")
	})

	t.Run("composes with an existing transport wrapper", func(t *testing.T) {
		inner := roundTripperFunc(func(*http.Request) (*http.Response, error) { return nil, nil })
		innerCalled := false
		cfg := &rest.Config{
			WrapTransport: func(http.RoundTripper) http.RoundTripper {
				innerCalled = true
				return inner
			},
		}

		wrapWithTracing(cfg)

		got := cfg.WrapTransport(roundTripperFunc(func(*http.Request) (*http.Response, error) { return nil, nil }))
		_, ok := got.(*otelhttp.Transport)
		require.True(t, ok, "otelhttp must remain the outermost transport")
		require.True(t, innerCalled, "the pre-existing transport wrapper must still be invoked")
	})
}

// The keys-only re-list posts to a route the typed clientset has no method for, so
// it uses ProvisioningRESTClient. That client has to carry the same exchanged
// access token as every other call the operator makes, or it authenticates as
// nobody on a real cluster. Asserted end to end through a stub signer.
func TestProvisioningRESTClientCarriesTheExchangedToken(t *testing.T) {
	signer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// authlib wraps the token in a data envelope.
		_, _ = w.Write([]byte(`{"data":{"token":"exchanged-access-token"}}`))
	}))
	t.Cleanup(signer.Close)

	var gotAuth, gotPath string
	apiserver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("X-Access-Token")
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"apiVersion":"storage.grafana.app/v0alpha1","kind":"ListKeyResponse","resourceVersion":"1","items":[]}`))
	}))
	t.Cleanup(apiserver.Close)

	raw := ini.Empty()
	grpcSec, err := raw.NewSection("grpc_client_authentication")
	require.NoError(t, err)
	_, err = grpcSec.NewKey("token", "operator-token")
	require.NoError(t, err)
	_, err = grpcSec.NewKey("token_exchange_url", signer.URL)
	require.NoError(t, err)
	operatorSec, err := raw.NewSection("operator")
	require.NoError(t, err)
	_, err = operatorSec.NewKey("provisioning_server_url", apiserver.URL)
	require.NoError(t, err)

	cfg := &ControllerConfig{Settings: &setting.Cfg{Raw: raw}, tracer: tracing.NewNoopTracerService()}

	client, err := cfg.ProvisioningRESTClient()
	require.NoError(t, err)

	_, err = client.Post().AbsPath("/apis", apisprovisioning.GROUP, apisprovisioning.VERSION, "connections", "list-keys").
		Body([]byte(`{}`)).DoRaw(t.Context())
	require.NoError(t, err)

	assert.Equal(t, "Bearer exchanged-access-token", gotAuth,
		"the REST client must send the exchanged token, as the clientset's transport does")
	assert.Equal(t, "/apis/provisioning.grafana.app/v0alpha1/connections/list-keys", gotPath)
}

// The aggregated server is the router: it publishes the app manifests, and it serves each group
// that has no server URL. Both requests carry a token for the provisioning audience.
func TestClientsServeManifestKindsFromTheAggregatedServer(t *testing.T) {
	router := routertest.NewServer(t, map[string]string{
		"/apis/discovery/v1alpha2/manifests":                          `{"apiVersion":"apps.grafana.app/v1alpha2","kind":"AppManifestList","items":[{"apiVersion":"apps.grafana.app/v1alpha2","kind":"AppManifest","metadata":{"name":"example"},"spec":{"appName":"example","group":"example.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Widget","scope":"Namespaced","extensions":{"provisioning":{"enabled":true}}}]}]}}]}`,
		"/apis/" + stubRouterGroup + "/v1":                            `{"kind":"APIResourceList","apiVersion":"v1","groupVersion":"example.ext.grafana.app/v1","resources":[{"name":"widgets","namespaced":true,"kind":"Widget","verbs":["get","list"]}]}`,
		"/apis/" + stubRouterGroup + "/v1/namespaces/default/widgets": `{"apiVersion":"example.ext.grafana.app/v1","kind":"WidgetList","items":[]}`,
	})
	cfg := newClientsConfig(t, newStubSigner(t).URL, map[string]string{"aggregated_server_url": router.URL})

	factory, err := cfg.Clients()
	require.NoError(t, err)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), cfg.manifestWatcher))
	t.Cleanup(cfg.manifestWatcher.StopAsync)

	clients, err := factory.Clients(t.Context(), "default")
	require.NoError(t, err)
	widget := schema.GroupVersionKind{Group: stubRouterGroup, Version: "v1", Kind: "Widget"}
	require.Contains(t, clients.SupportedResources(), resources.SupportedResource{GroupKind: widget.GroupKind(), Capabilities: sets.New(resources.CapabilityFolder)})

	client, _, err := clients.ForKind(t.Context(), widget)
	require.NoError(t, err)
	_, err = client.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)

	token := "Bearer token-for-" + apisprovisioning.GROUP
	require.Equal(t, token, router.AccessToken("/apis/discovery/v1alpha2/manifests"))
	require.Equal(t, token, router.AccessToken("/apis/"+stubRouterGroup+"/v1/namespaces/default/widgets"))
}

func TestClientsUseTheRouterForDashboardsWithTheRouterClientSetting(t *testing.T) {
	dashboards := "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards"
	router := routertest.NewServer(t, map[string]string{
		"/apis/dashboard.grafana.app/v1": `{"kind":"APIResourceList","apiVersion":"v1","groupVersion":"dashboard.grafana.app/v1","resources":[{"name":"dashboards","namespaced":true,"kind":"Dashboard","verbs":["list"]}]}`,
		dashboards:                       `{"apiVersion":"dashboard.grafana.app/v1","kind":"DashboardList","items":[]}`,
	})
	cfg := newClientsConfig(t, newStubSigner(t).URL, map[string]string{"aggregated_server_url": router.URL})
	cfg.Settings.ProvisioningRouterClient = true

	factory, err := cfg.Clients()
	require.NoError(t, err)
	clients, err := factory.Clients(t.Context(), "default")
	require.NoError(t, err)
	client, _, err := clients.ForKind(t.Context(), resources.DashboardResource.GroupVersion().WithKind("Dashboard"))
	require.NoError(t, err)
	_, err = client.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)

	require.Equal(t, "Bearer token-for-dashboard.grafana.app,"+apisprovisioning.GROUP, router.AccessToken(dashboards))
}

// Production has no aggregated server yet, so the operators must run with the configured
// resources only.
func TestClientsWithoutAnAggregatedServer(t *testing.T) {
	t.Run("serves the configured resources and watches no manifests", func(t *testing.T) {
		cfg := newClientsConfig(t, newStubSigner(t).URL, nil)

		factory, err := cfg.Clients()
		require.NoError(t, err)
		require.NoError(t, services.StartAndAwaitRunning(t.Context(), cfg.manifestWatcher))
		t.Cleanup(cfg.manifestWatcher.StopAsync)

		clients, err := factory.Clients(t.Context(), "default")
		require.NoError(t, err)
		require.Len(t, clients.SupportedResources(), len(cfg.Settings.ProvisioningResources))
	})

	t.Run("fails for a configured resource that has no server", func(t *testing.T) {
		cfg := newClientsConfig(t, newStubSigner(t).URL, nil)
		cfg.Settings.ProvisioningResources = append(cfg.Settings.ProvisioningResources, "playlist.grafana.app/Playlist")

		_, err := cfg.Clients()
		require.ErrorContains(t, err, "aggregated_server_url is required")
	})
}

func TestControllersOwnNATSSubscriber(t *testing.T) {
	originalOptions := registeredConfigOptions
	t.Cleanup(func() { registeredConfigOptions = originalOptions })

	for _, controller := range []struct {
		name string
		run  func(context.Context, server.OperatorDependencies) error
	}{
		{"repository", RunRepoController},
		{"connection", RunConnectionController},
		{"job queue", RunJobQueueController},
	} {
		t.Run(controller.name, func(t *testing.T) {
			srv, err := natsserver.NewServer(&natsserver.Options{Host: "127.0.0.1", Port: natsserver.RANDOM_PORT, NoLog: true, NoSigs: true})
			require.NoError(t, err)
			go srv.Start()
			t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
			require.True(t, srv.ReadyForConnections(5*time.Second))

			cfg := setting.NewCfg()
			cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{srv.ClientURL()}}

			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if strings.HasSuffix(r.URL.Path, "/"+utils.ListKeysPathSegment) {
					_, _ = fmt.Fprintf(w, `{"apiVersion":%q,"kind":%q,"resourceVersion":"1","items":[]}`, storagev0.APIVERSION, storagev0.KindListKeyResponse)
					return
				}
				kinds := map[string]string{"repositories": "RepositoryList", "connections": "ConnectionList", "jobs": "JobList"}
				kind := kinds[r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]]
				if kind == "" {
					t.Errorf("unexpected API request: %s", r.URL)
					http.NotFound(w, r)
					return
				}
				_, _ = fmt.Fprintf(w, `{"apiVersion":"provisioning.grafana.app/v0alpha1","kind":%q,"metadata":{"resourceVersion":"1"},"items":[]}`, kind)
			}))
			t.Cleanup(api.Close)
			restCfg := &rest.Config{Host: api.URL, APIPath: "/apis"}
			provisioningClient, err := client.NewForConfig(restCfg)
			require.NoError(t, err)
			registeredConfigOptions = []ConfigOption{func(_ context.Context, cfg *ControllerConfig) error {
				cfg.tracer = tracing.NewNoopTracerService()
				cfg.provisioningClient = provisioningClient
				cfg.provisioningRESTCfg = restCfg
				cfg.clients = resources.NewMockClientFactory(t)
				cfg.manifestWatcher = services.NewIdleService(nil, nil)
				// Empty resource lists must not access unified storage.
				cfg.unified = &struct{ resources.ResourceStore }{}
				cfg.repositoryFactory, err = repository.ProvideFactory(nil, nil, cfg.tracer)
				if err != nil {
					return err
				}
				cfg.connectionFactory, err = connection.ProvideFactory(nil, nil, cfg.tracer)
				return err
			}}
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			health := server.NewHealthNotifier()
			done := make(chan error, 1)
			go func() {
				done <- controller.run(ctx, server.OperatorDependencies{Config: cfg, Registerer: prometheus.NewRegistry(), HealthNotifier: health})
			}()
			require.NoError(t, wait.PollUntilContextTimeout(ctx, 10*time.Millisecond, 10*time.Second, true, func(context.Context) (bool, error) {
				select {
				case err := <-done:
					return false, fmt.Errorf("controller stopped before becoming ready (error: %v)", err)
				default:
				}
				stats, err := srv.Varz(nil)
				return health.IsReady() && err == nil && stats.TotalConnections == 1 && stats.Connections == 1 && stats.Subscriptions > 0, err
			}), "controller must own an active subscriber before becoming ready")
			cancel()
			select {
			case err := <-done:
				require.NoError(t, err)
			case <-time.After(5 * time.Second):
				t.Fatal("controller did not stop")
			}
			require.Eventually(t, func() bool { return srv.NumClients() == 0 }, time.Second, time.Millisecond, "controller must close its subscriber on shutdown")
		})
	}
}

// The collectors register on first call, so a second call that rebuilt them
// would panic on the duplicate.
func TestRelistProjectionMetricsIsMemoized(t *testing.T) {
	cfg := &ControllerConfig{}

	first := cfg.RelistProjectionMetrics()
	require.NotNil(t, first)
	require.Same(t, first, cfg.RelistProjectionMetrics())
}

// Building the REST client fails rather than returning a nil lister, which
// would silently fall back to the full-object re-list.
func TestProvisioningKeysListerRequiresARESTClient(t *testing.T) {
	cfg := &ControllerConfig{Settings: &setting.Cfg{Raw: ini.Empty()}}

	_, err := cfg.ProvisioningKeysLister(apisprovisioning.RepositoryResourceInfo.GroupVersionResource())
	require.Error(t, err)
}

func TestControllerConfigResourceLister(t *testing.T) {
	newConfig := func(mode string) *ControllerConfig {
		cfg := setting.NewCfg()
		cfg.ProvisioningResources = []string{"folder.grafana.app/Folder:folder"}
		cfg.ProvisioningResourceLister = mode
		// Injected so the only dependency left to resolve is the unified storage client.
		return &ControllerConfig{
			Settings: cfg,
			clients:  resources.NewMockClientFactory(t),
			tracer:   tracing.NewNoopTracerService(),
		}
	}

	t.Run("apis mode reads the provisioning API and does not dial unified storage", func(t *testing.T) {
		c := newConfig(resources.ListerAPIs)
		for section, keys := range map[string]map[string]string{
			"grpc_client_authentication": {"token": "t", "token_exchange_url": "http://localhost/exchange"},
			"operator":                   {"provisioning_server_url": "http://localhost:3000"},
		} {
			for k, v := range keys {
				_, err := c.Settings.Raw.Section(section).NewKey(k, v)
				require.NoError(t, err)
			}
		}

		lister, err := c.ResourceLister()
		require.NoError(t, err, "no [unified_storage] grpc_address is configured, so a dial would fail")
		require.IsType(t, &resources.ResourceListerFromProvisioningAPI{}, lister)
		require.Nil(t, c.unified)
	})

	t.Run("apis mode fails without a provisioning server to read from", func(t *testing.T) {
		_, err := newConfig(resources.ListerAPIs).ResourceLister()
		require.ErrorContains(t, err, "failed to create provisioning REST client")
	})

	t.Run("search mode still requires unified storage", func(t *testing.T) {
		_, err := newConfig(resources.ListerSearch).ResourceLister()
		require.ErrorContains(t, err, "grpc_address is required")
	})

	t.Run("an unknown mode fails at startup", func(t *testing.T) {
		_, err := newConfig("index").ResourceLister()
		require.ErrorContains(t, err, `invalid [provisioning] resource_lister "index": expected "search" or "apis"`)
	})
}

const stubRouterGroup = "example.ext.grafana.app"

// newClientsConfig returns a config with the settings that Clients needs, plus the given
// [operator] keys. Dashboards and folders have server URLs that no test calls.
func newClientsConfig(t *testing.T, signerURL string, operator map[string]string) *ControllerConfig {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.ProvisioningResources = []string{"folder.grafana.app/Folder:folder", "dashboard.grafana.app/Dashboard:folder"}
	sections := map[string]map[string]string{
		"grpc_client_authentication": {"token": "operator-token", "token_exchange_url": signerURL},
		"operator":                   {"dashboards_server_url": "https://dashboards.invalid", "folders_server_url": "https://folders.invalid"},
	}
	for k, v := range operator {
		sections["operator"][k] = v
	}
	for section, keys := range sections {
		for k, v := range keys {
			_, err := cfg.Raw.Section(section).NewKey(k, v)
			require.NoError(t, err)
		}
	}
	return &ControllerConfig{Settings: cfg, tracer: tracing.NewNoopTracerService()}
}

// newStubSigner returns a token exchange server. Each token names the audiences of its request.
func newStubSigner(t *testing.T) *httptest.Server {
	t.Helper()
	signer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Audiences []string `json:"audiences"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{"token": "token-for-" + strings.Join(req.Audiences, ",")}})
	}))
	t.Cleanup(signer.Close)
	return signer
}

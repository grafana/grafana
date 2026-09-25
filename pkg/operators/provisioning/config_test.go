package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"k8s.io/client-go/rest"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

func TestDefaultConnectionTypes(t *testing.T) {
	registeredTypes := []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		apisprovisioning.GithubEnterpriseConnectionType,
		apisprovisioning.GithubOAuthConnectionType,
		apisprovisioning.GithubEnterpriseOAuthConnectionType,
		apisprovisioning.BitbucketOAuthConnectionType,
		apisprovisioning.GitlabOAuthConnectionType,
	}
	extras := make([]connection.Extra, 0, len(registeredTypes))
	for _, connectionType := range registeredTypes {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	require.ElementsMatch(t, []string{"github", "githubEnterprise"}, defaultConnectionTypes(extras))
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
				kinds := map[string]string{"repositories": "RepositoryList", "connections": "ConnectionList", "jobs": "JobList"}
				kind := kinds[r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]]
				if kind == "" {
					t.Errorf("unexpected API request: %s", r.URL)
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = fmt.Fprintf(w, `{"apiVersion":"provisioning.grafana.app/v0alpha1","kind":%q,"metadata":{"resourceVersion":"1"},"items":[]}`, kind)
			}))
			t.Cleanup(api.Close)
			provisioningClient, err := client.NewForConfig(&rest.Config{Host: api.URL})
			require.NoError(t, err)
			registeredConfigOptions = []ConfigOption{func(_ context.Context, cfg *ControllerConfig) error {
				cfg.tracer = tracing.NewNoopTracerService()
				cfg.provisioningClient = provisioningClient
				cfg.clients = resources.NewMockClientFactory(t)
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
			require.Eventually(t, func() bool {
				select {
				case err := <-done:
					require.NoError(t, err)
					t.Fatal("controller stopped before becoming ready")
				default:
				}
				stats, err := srv.Varz(nil)
				return health.IsReady() && err == nil && stats.TotalConnections == 1 && stats.Connections == 1 && stats.Subscriptions > 0
			}, 10*time.Second, 10*time.Millisecond, "controller must own an active subscriber before becoming ready")
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

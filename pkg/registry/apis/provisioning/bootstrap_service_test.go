package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/bootstrap"
	"github.com/grafana/grafana/pkg/setting"
)

func TestBootstrapService_IsDisabled(t *testing.T) {
	tests := []struct {
		name    string
		builder *APIBuilder
		want    bool
	}{
		{name: "provisioning disabled", builder: nil, want: true},
		{name: "controllers enabled", builder: &APIBuilder{}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, err := ProvideBootstrapService(&setting.Cfg{}, tt.builder)
			require.NoError(t, err)
			require.Equal(t, tt.want, svc.IsDisabled())
			// The background service manager looks up this name in its
			// dependency map; any other name would start it after Core.
			require.Equal(t, BootstrapServiceName, svc.ServiceName())
		})
	}
}

func TestProvideBootstrapService_Config(t *testing.T) {
	t.Run("reads bootstrap_path when provisioning is enabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningBootstrapPath = "/etc/grafana/bootstrap"
		cfg.ProvisioningAllowedTargets = []string{string(bootstrap.SyncTarget)}

		svc, err := ProvideBootstrapService(cfg, &APIBuilder{})
		require.NoError(t, err)
		require.Equal(t, bootstrap.Config{Path: "/etc/grafana/bootstrap", Namespace: "default"}, svc.config)
	})

	t.Run("reconciles with no path so a previously registered repository is removed", func(t *testing.T) {
		svc, err := ProvideBootstrapService(setting.NewCfg(), &APIBuilder{})
		require.NoError(t, err)
		require.Equal(t, bootstrap.Config{Namespace: "default"}, svc.config)
		require.True(t, svc.config.Reconcilable())
	})

	t.Run("ignores the configuration when provisioning is disabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningBootstrapPath = "relative/path"

		svc, err := ProvideBootstrapService(cfg, nil)
		require.NoError(t, err)
		require.Equal(t, bootstrap.Config{}, svc.config)
	})

	t.Run("rejects an invalid bootstrap_path", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningBootstrapPath = "relative/path"

		_, err := ProvideBootstrapService(cfg, &APIBuilder{})
		require.Error(t, err)
	})
}

// fakeBootstrapRepositories serves no existing repository, records what is
// created, and fails every read with getErr when set.
type fakeBootstrapRepositories struct {
	onGet   func()
	getErr  error
	created []*provisioning.Repository
}

func (f *fakeBootstrapRepositories) Get(_ context.Context, name string, _ metav1.GetOptions) (*provisioning.Repository, error) {
	if f.onGet != nil {
		f.onGet()
	}
	if f.getErr != nil {
		return nil, f.getErr
	}
	return nil, apierrors.NewNotFound(provisioning.RepositoryResourceInfo.GroupResource(), name)
}

func (f *fakeBootstrapRepositories) Create(_ context.Context, repo *provisioning.Repository, _ metav1.CreateOptions) (*provisioning.Repository, error) {
	f.created = append(f.created, repo)
	return repo, nil
}

func (f *fakeBootstrapRepositories) Update(context.Context, *provisioning.Repository, metav1.UpdateOptions) (*provisioning.Repository, error) {
	return nil, errors.New("unexpected update")
}

func (f *fakeBootstrapRepositories) Delete(context.Context, string, metav1.DeleteOptions) error {
	return errors.New("unexpected delete")
}

// newTestBootstrapService reconciles config against repos, recording the rest
// config and namespace the repositories client was built for.
func newTestBootstrapService(config bootstrap.Config, repos *fakeBootstrapRepositories) (*BootstrapService, *APIBuilder, <-chan *clientrest.Config) {
	builder := &APIBuilder{loopbackReady: make(chan struct{})}
	svc, _ := ProvideBootstrapService(nil, nil)
	svc.builder = builder
	svc.config = config
	got := make(chan *clientrest.Config, 1)
	svc.repositories = func(restConfig *clientrest.Config, namespace string) (bootstrap.Repositories, error) {
		if namespace != config.Namespace {
			return nil, errors.New("unexpected namespace " + namespace)
		}
		got <- restConfig
		return repos, nil
	}
	return svc, builder, got
}

func TestBootstrapService_Run(t *testing.T) {
	t.Run("reconciles on the loopback config, then signals done and keeps running", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			repos := &fakeBootstrapRepositories{}
			svc, builder, got := newTestBootstrapService(bootstrap.Config{Path: "/bootstrap", Namespace: "default"}, repos)
			repos.onGet = func() {
				assert.False(t, isClosed(svc.Done()), "done signalled before the bootstrap repository was reconciled")
			}
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

			synctest.Wait()
			require.Empty(t, got, "reconciled before the provisioning API was served")
			require.False(t, isClosed(svc.Done()))

			loopback := &clientrest.Config{Host: "https://loopback"}
			builder.publishLoopbackConfig(loopback)
			synctest.Wait()
			require.Same(t, loopback, <-got)
			require.Len(t, repos.created, 1)
			require.Equal(t, bootstrap.Name, repos.created[0].Name)
			require.True(t, isClosed(svc.Done()))
			require.Equal(t, services.Running, svc.State(), "must stay running so the modules depending on it can start")

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})

	t.Run("signals done and keeps running when reconcile fails", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			repos := &fakeBootstrapRepositories{getErr: apierrors.NewInternalError(errors.New("boom"))}
			svc, builder, _ := newTestBootstrapService(bootstrap.Config{Path: "/bootstrap", Namespace: "default"}, repos)
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

			builder.publishLoopbackConfig(&clientrest.Config{})
			synctest.Wait()
			require.True(t, isClosed(svc.Done()), "a failed reconcile must not leave the repository controller waiting forever")
			require.Equal(t, services.Running, svc.State(), "a failed reconcile must not fail the service")

			svc.StopAsync()
			require.NoError(t, <-runErr)
		})
	})

	t.Run("signals done when there is nothing to reconcile", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, builder, got := newTestBootstrapService(bootstrap.Config{}, &fakeBootstrapRepositories{})
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

			builder.publishLoopbackConfig(&clientrest.Config{})
			synctest.Wait()
			require.True(t, isClosed(svc.Done()))
			require.Empty(t, got, "nothing to reconcile without a namespace")

			svc.StopAsync()
			require.NoError(t, <-runErr)
		})
	})

	t.Run("signals done when stopped before the provisioning API is served", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, _, got := newTestBootstrapService(bootstrap.Config{Namespace: "default"}, &fakeBootstrapRepositories{})
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
			require.True(t, isClosed(svc.Done()))
			require.Empty(t, got)
		})
	})

	t.Run("reads the bootstrap repository through the loopback config", func(t *testing.T) {
		requested := make(chan string, 1)
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case requested <- r.Method + " " + r.URL.Path:
			default:
			}
			http.NotFound(w, r)
		}))
		t.Cleanup(server.Close)

		builder := &APIBuilder{loopbackReady: make(chan struct{})}
		builder.publishLoopbackConfig(&clientrest.Config{Host: server.URL})
		svc, err := ProvideBootstrapService(setting.NewCfg(), builder)
		require.NoError(t, err)
		runErr := make(chan error, 1)
		go func() { runErr <- svc.Run(context.Background()) }()
		t.Cleanup(svc.StopAsync)

		receive(t, svc.Done(), runErr)
		require.Equal(t, "GET /apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/bootstrap", receive(t, requested, runErr))

		svc.StopAsync()
		require.NoError(t, waitForRun(t, runErr))
	})
}

func TestAPIBuilder_GetReadyzChecks(t *testing.T) {
	t.Run("has no check without a bootstrap service", func(t *testing.T) {
		require.Empty(t, (&APIBuilder{}).GetReadyzChecks())
	})

	t.Run("is not ready until the bootstrap repository is reconciled", func(t *testing.T) {
		builder := &APIBuilder{}
		svc, err := ProvideBootstrapService(setting.NewCfg(), builder)
		require.NoError(t, err)

		checks := builder.GetReadyzChecks()
		require.Len(t, checks, 1)
		require.Equal(t, BootstrapServiceName, checks[0].Name())
		require.Error(t, checks[0].Check(nil))

		close(svc.done)
		require.NoError(t, checks[0].Check(nil))
	})
}

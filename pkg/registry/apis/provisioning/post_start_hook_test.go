package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	genericapiserver "k8s.io/apiserver/pkg/server"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/bootstrap"
)

func newPostStartHookTestBuilder() *APIBuilder {
	return &APIBuilder{
		gv:              provisioning.SchemeGroupVersion,
		bootstrapConfig: bootstrap.Config{Namespace: "default"},
		onlyApiServer:   true,
		registry:        prometheus.NewRegistry(),
		loopbackReady:   make(chan struct{}),
		bootstrapDone:   make(chan struct{}),
	}
}

func runPostStartHooks(t *testing.T, b *APIBuilder, loopback *clientrest.Config) error {
	t.Helper()
	hooks, err := b.GetPostStartHooks()
	require.NoError(t, err)
	require.Len(t, hooks, 1)
	for _, hook := range hooks {
		if err := hook(genericapiserver.PostStartHookContext{LoopbackClientConfig: loopback, Context: t.Context()}); err != nil {
			return err
		}
	}
	return nil
}

func TestPostStartHook_PublishesLoopbackConfigBeforeAndSignalsBootstrapAfterReconcile(t *testing.T) {
	b := newPostStartHookTestBuilder()

	reconciled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only the repository controller waits for the bootstrap repository;
		// token refresh and queued jobs start on the loopback config.
		assert.True(t, isClosed(b.loopbackReady), "loopback config must be published before the bootstrap repository is reconciled")
		assert.False(t, isClosed(b.bootstrapDone), "bootstrap signalled before the bootstrap repository was reconciled: %s %s", r.Method, r.URL)
		reconciled = true
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)

	loopback := &clientrest.Config{Host: server.URL}
	require.NoError(t, runPostStartHooks(t, b, loopback))

	require.True(t, reconciled, "the hook should reconcile the bootstrap repository")
	require.True(t, isClosed(b.bootstrapDone), "bootstrap must be signalled once the hook returns")
	got, err := b.awaitLoopbackConfig(t.Context())
	require.NoError(t, err)
	require.Same(t, loopback, got)
}

func TestPostStartHook_SignalsBootstrapOnEveryReturn(t *testing.T) {
	t.Run("rest config error", func(t *testing.T) {
		b := newPostStartHookTestBuilder()
		errConfig := errors.New("no rest config")
		b.restConfigGetter = func(context.Context) (*clientrest.Config, error) { return nil, errConfig }

		require.ErrorIs(t, runPostStartHooks(t, b, nil), errConfig)
		require.True(t, isClosed(b.bootstrapDone), "a failed hook must not leave the repository controller waiting forever")
	})

	t.Run("no bootstrap repository to reconcile", func(t *testing.T) {
		b := newPostStartHookTestBuilder()
		b.bootstrapConfig = bootstrap.Config{}

		require.NoError(t, runPostStartHooks(t, b, &clientrest.Config{Host: "http://127.0.0.1:0"}))
		require.True(t, isClosed(b.loopbackReady))
		require.True(t, isClosed(b.bootstrapDone))
	})
}

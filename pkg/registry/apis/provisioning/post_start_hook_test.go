package provisioning

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	genericapiserver "k8s.io/apiserver/pkg/server"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func newPostStartHookTestBuilder() *APIBuilder {
	return &APIBuilder{
		gv:            provisioning.SchemeGroupVersion,
		registry:      prometheus.NewRegistry(),
		loopbackReady: make(chan struct{}),
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

func TestPostStartHook_PublishesLoopbackConfig(t *testing.T) {
	b := newPostStartHookTestBuilder()

	loopback := &clientrest.Config{Host: "http://127.0.0.1:0"}
	require.NoError(t, runPostStartHooks(t, b, loopback))

	got, err := b.awaitLoopbackConfig(t.Context())
	require.NoError(t, err)
	require.Same(t, loopback, got)
	require.NotNil(t, b.client, "API endpoints use the client built on the loopback config")
	require.NotNil(t, b.jobs)
	require.NotNil(t, b.statusPatcher)
	require.NotNil(t, b.healthChecker)
}

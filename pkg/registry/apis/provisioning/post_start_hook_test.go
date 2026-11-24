package provisioning

import (
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

func TestPostStartHook_PublishesLoopbackConfigAfterBootstrapReconcile(t *testing.T) {
	b := &APIBuilder{
		gv:              provisioning.SchemeGroupVersion,
		bootstrapConfig: bootstrap.Config{Namespace: "default"},
		onlyApiServer:   true,
		registry:        prometheus.NewRegistry(),
		loopbackReady:   make(chan struct{}),
	}

	reconciled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-b.loopbackReady:
			assert.Fail(t, "loopback config published before the bootstrap repository was reconciled", "%s %s", r.Method, r.URL)
		default:
		}
		reconciled = true
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)

	hooks, err := b.GetPostStartHooks()
	require.NoError(t, err)
	require.Len(t, hooks, 1)
	loopback := &clientrest.Config{Host: server.URL}
	for _, hook := range hooks {
		require.NoError(t, hook(genericapiserver.PostStartHookContext{LoopbackClientConfig: loopback, Context: t.Context()}))
	}

	require.True(t, reconciled, "the hook should reconcile the bootstrap repository")
	got, err := b.awaitLoopbackConfig(t.Context())
	require.NoError(t, err)
	require.Same(t, loopback, got)
}

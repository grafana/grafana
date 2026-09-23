package appplugin

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginsOverRouter(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const group = "router-test.ext.grafana.app"
	mux := http.NewServeMux()
	mux.HandleFunc("GET /plugins", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"plugins":[{"definition":{
   "jsonData":{"id":"router-test-app","type":"app"},
   "manifest":{
    "appName":"router-test-app","group":"router-test.ext.grafana.app","preferredVersion":"v1",
    "versions":[{"name":"v1","served":true,"kinds":[
     {"kind":"Thing","plural":"things","scope":"Namespaced","folderScoped":false,
      "schemas":{"Thing":{"type":"object","properties":{"spec":{"type":"object","properties":{"value":{"type":"string"}}}}}}},
     {"kind":"Widget","plural":"widgets","scope":"Namespaced","folderScoped":false,
      "schemas":{"Widget":{"type":"object","properties":{"spec":{"type":"object","properties":{"value":{"type":"string"}}}}}}}
    ]}]
   }
  }}]}`))
	})
	manifests := httptest.NewServer(mux)
	t.Cleanup(manifests.Close)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
	t.Cleanup(helper.Shutdown)
	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("cloud_router").Key("plugins_url").SetValue(manifests.URL + "/plugins")
	loader, err := router.ProvideRoutesLoader(cfg, router.PluginLoaderDependencies{
		PluginDependencies: router.PluginDependencies{Cfg: cfg, Unified: helper.GetEnv().ResourceClient},
	})
	require.NoError(t, err)
	lifecycle, ok := loader.(services.Service)
	require.True(t, ok)
	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	require.NoError(t, services.StartAndAwaitRunning(ctx, lifecycle))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), lifecycle)) })
	apiRouter := router.NewGrafanaRouter(loader)
	require.NoError(t, apiRouter.Run(ctx))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiRouter.HandleFunc(w, r, http.NotFoundHandler())
	}))
	t.Cleanup(server.Close)
	clientCfg := &k8srest.Config{Host: server.URL}
	clientCfg.Wrap(func(next http.RoundTripper) http.RoundTripper {
		return pluginRouterTokenTransport{next: next}
	})
	client, err := dynamic.NewForConfig(clientCfg)
	require.NoError(t, err)

	for _, kind := range []struct{ name, plural string }{{"Thing", "things"}, {"Widget", "widgets"}} {
		t.Run(kind.name, func(t *testing.T) {
			// The cloud router's temporary token authenticator supplies this namespace.
			resource := client.Resource(schema.GroupVersionResource{Group: group, Version: "v1", Resource: kind.plural}).Namespace("stacks-5457")
			ctx := t.Context()
			require.EventuallyWithT(t, func(c *assert.CollectT) {
				_, err := resource.List(ctx, metav1.ListOptions{})
				assert.NoError(c, err, "%#v", err)
			}, 30*time.Second, 100*time.Millisecond, "router should load the polled manifest")

			created, err := resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": group + "/v1", "kind": kind.name,
				"metadata": map[string]any{"name": "example"},
				"spec":     map[string]any{"value": "initial"},
			}}, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotEmpty(t, created.GetUID())
			require.NotEmpty(t, created.GetResourceVersion())

			got, err := resource.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, created.GetUID(), got.GetUID())
			require.Equal(t, "initial", got.Object["spec"].(map[string]any)["value"])

			require.NoError(t, unstructured.SetNestedField(got.Object, "updated", "spec", "value"))
			updated, err := resource.Update(ctx, got, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotEqual(t, created.GetResourceVersion(), updated.GetResourceVersion())
			got, err = resource.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, "updated", got.Object["spec"].(map[string]any)["value"])

			list, err := resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, list.Items, 1)
			require.Equal(t, created.GetUID(), list.Items[0].GetUID())

			require.NoError(t, resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
			_, err = resource.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.True(t, apierrors.IsNotFound(err), "expected NotFound after deletion, got %v", err)
			list, err = resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, list.Items)
		})
	}
}

type pluginRouterTokenTransport struct {
	next http.RoundTripper
}

func (t pluginRouterTokenTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.Header.Set("X-Access-Token", "test-token")
	return t.next.RoundTrip(req)
}

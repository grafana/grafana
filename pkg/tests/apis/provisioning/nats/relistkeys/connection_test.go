package relistkeys

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func githubConnection(name string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      name,
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Keys-only ReList Connection",
			"type":  provisioning.GitHubRepositoryType,
			"github": map[string]any{
				"appID":          "12345",
				"installationID": "67890",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM)),
			},
		},
	}}
}

func createConnection(t *testing.T, helper *common.ProvisioningTestHelper, name string) string {
	t.Helper()
	created, err := helper.CreateGithubConnection(t, githubConnection(name))
	require.NoError(t, err, "failed to create connection")
	t.Cleanup(func() {
		cleanupCtx := context.WithoutCancel(t.Context())
		_ = helper.Connections.Resource.Delete(cleanupCtx, created.GetName(), metav1.DeleteOptions{})
	})
	return created.GetName()
}

// Nothing publishes watch notifications here, so a created Connection can only
// reach the controller through the periodic re-list, and with the setting on that
// re-list carries keys rather than bodies. Reaching healthy therefore proves the
// controller reconciles from identities alone, re-fetching what it needs.
func TestIntegrationProvisioningKeysReList_ConnectionReconciledFromKeys(t *testing.T) {
	helper := sharedHelper(t)
	name := createConnection(t, helper, "keys-relist-connection")

	helper.WaitForHealthyConnection(t, name)
}

// Tests with a real store, showing it honours keys_only, using the same client as
// the in-process informer.
func TestIntegrationProvisioningKeysReList_ListerReadsRealStorage(t *testing.T) {
	helper := sharedHelper(t)
	name := createConnection(t, helper, "keys-relist-lister")

	ctx, _, err := identity.WithProvisioningIdentity(t.Context(), helper.Namespace)
	require.NoError(t, err)

	lister := informer.NewGRPCConnectionKeysLister(helper.GetEnv().ResourceClient)
	listRV, seq := lister.ListKeys(ctx)
	assert.NotZero(t, listRV, "the snapshot version callers arbitrate races with")

	keys := map[string]informer.Key{}
	for k, err := range seq {
		require.NoError(t, err, "the server must honour keys_only")
		keys[k.Name] = k
	}

	got, found := keys[name]
	require.True(t, found, "the created connection must appear in the keys list, got %v", keys)
	assert.Equal(t, helper.Namespace, got.Namespace)
	assert.NotEmpty(t, got.ResourceVersion, "the per-key version is what the Store diffs on")
}

// scrapeMetric returns the value of one labelled counter from the server's own
// /metrics, which is how the rollout is read in a deployment too.
func scrapeMetric(t *testing.T, helper *common.ProvisioningTestHelper, sample string) float64 {
	t.Helper()
	rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
		Method: http.MethodGet, Path: "/metrics", User: helper.Org1.Admin,
	}, &metav1.Status{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)

	for line := range strings.Lines(string(rsp.Body)) {
		name, value, found := strings.Cut(strings.TrimSpace(line), " ")
		if !found || name != sample {
			continue
		}
		v, err := strconv.ParseFloat(value, 64)
		require.NoError(t, err)
		return v
	}
	return 0
}

// Reconciling proves the pipeline works; this proves it worked on keys. The
// counter distinguishes the projection from the full-object fallback, so a server
// that quietly served bodies would not pass.
func TestIntegrationProvisioningKeysReList_UsesTheKeysProjection(t *testing.T) {
	helper := sharedHelper(t)
	name := createConnection(t, helper, "keys-relist-projection")
	helper.WaitForHealthyConnection(t, name)

	const keys = `grafana_provisioning_informer_relist_projection_total{projection="keys",resource="connections"}`
	const objects = `grafana_provisioning_informer_relist_projection_total{projection="objects",resource="connections"}`

	assert.Positive(t, scrapeMetric(t, helper, keys), "the re-list must have run on the keys projection")
	assert.Zero(t, scrapeMetric(t, helper, objects), "no tick may have fallen back to full objects")
}

// The operator's transport, end to end: a real HTTP request, the real handler, and
// real storage. Only the authentication layer is stood in for, because a service
// identity is built in process and no test client can hold one over HTTP.
func TestIntegrationProvisioningKeysReList_HTTPListerReadsRealStorage(t *testing.T) {
	helper := sharedHelper(t)
	name := createConnection(t, helper, "keys-relist-http")

	gvr := provisioning.ConnectionResourceInfo.GroupVersionResource()
	route := keysapi.NewHandler(helper.GetEnv().ResourceClient, noop.NewTracerProvider().Tracer("test")).
		ListKeysRoute(gvr.Group, gvr.Version, gvr.Resource, "Connection")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		route.Handler(w, r.WithContext(identity.WithServiceIdentityContext(r.Context(), 1)))
	}))
	t.Cleanup(srv.Close)

	client, err := rest.RESTClientFor(&rest.Config{
		Host:          srv.URL,
		APIPath:       "/apis",
		ContentConfig: rest.ContentConfig{GroupVersion: &schema.GroupVersion{Group: gvr.Group, Version: gvr.Version}, NegotiatedSerializer: scheme.Codecs.WithoutConversion()},
	})
	require.NoError(t, err)

	listRV, seq := informer.NewHTTPConnectionKeysLister(client).ListKeys(t.Context())
	assert.NotZero(t, listRV, "the snapshot version callers arbitrate races with")

	keys := map[string]informer.Key{}
	for k, err := range seq {
		require.NoError(t, err, "the endpoint must serve a keys projection over HTTP")
		keys[k.Name] = k
	}

	got, found := keys[name]
	require.True(t, found, "the created connection must appear, got %v", keys)
	assert.Equal(t, helper.Namespace, got.Namespace)
	assert.NotEmpty(t, got.ResourceVersion, "the per-key version is what the Store diffs on")
}

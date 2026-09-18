package keys

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvr = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v1beta1",
	Resource: "dashboards",
}

// Spelled out, so a test cannot pass comparing the projection against itself.
const listKind = "PartialObjectMetadataList"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupTest(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	return newHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  true,
		EnableKeysAPI:     true,
	})
}

// Mirrors the shipped default: the gate is off and absent from defaults.ini.
func setupWithoutKeysAPI(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	return newHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  true,
	})
}

func newHelper(t *testing.T, opts testinfra.GrafanaOpts) *apis.K8sTestHelper {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	return apis.NewK8sTestHelper(t, opts)
}

func adminNamespace(helper *apis.K8sTestHelper) string {
	return helper.Org1.Admin.Identity.GetNamespace()
}

// The two paths the host builds from one route path.
func clusterPath() string {
	return "/apis/" + gvr.Group + "/" + gvr.Version + "/" + gvr.Resource + "/" + utils.ListKeysPathSegment
}

func namespacedPath(namespace string) string {
	return "/apis/" + gvr.Group + "/" + gvr.Version +
		"/namespaces/" + namespace + "/" + gvr.Resource + "/" + utils.ListKeysPathSegment
}

func specPath() string {
	return "/openapi/v3/apis/" + gvr.Group + "/" + gvr.Version
}

func dashboardClient(t *testing.T, helper *apis.K8sTestHelper) *apis.K8sResourceClient {
	t.Helper()
	return helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvr})
}

func orgBDashboardClient(t *testing.T, helper *apis.K8sTestHelper) *apis.K8sResourceClient {
	t.Helper()
	return helper.GetResourceClient(apis.ResourceClientArgs{User: helper.OrgB.Admin, GVR: gvr})
}

func createDashboard(t *testing.T, client *apis.K8sResourceClient, name, title string) error {
	t.Helper()
	_, err := client.Resource.Create(t.Context(), &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": gvr.Group + "/" + gvr.Version,
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": name},
			"spec":       map[string]any{"title": title},
		},
	}, metav1.CreateOptions{})
	return err
}

// Returns the raw response, so a test asserts on what was actually served.
func request(t *testing.T, helper *apis.K8sTestHelper, method, path, body string) (int, string) {
	t.Helper()
	params := apis.RequestParams{Method: method, Path: path, User: helper.Org1.Admin}
	if body != "" {
		params.Body = []byte(body)
	}
	rsp := apis.DoRequest(helper, params, &metav1.Status{})
	require.NotNil(t, rsp.Response)
	return rsp.Response.StatusCode, string(rsp.Body)
}

func servedSpecPaths(t *testing.T, helper *apis.K8sTestHelper) map[string]any {
	t.Helper()
	rsp := apis.DoRequest(helper, apis.RequestParams{
		Method: http.MethodGet, Path: specPath(), User: helper.Org1.Admin,
	}, &spec3.OpenAPI{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)

	var doc map[string]any
	require.NoError(t, json.Unmarshal(rsp.Body, &doc))
	paths, ok := doc["paths"].(map[string]any)
	require.True(t, ok, "served spec has no paths")
	return paths
}

// Through the real apiserver: routing, the authorizer restatement, the namespace
// off the path, and the projection. The handler unit tests see none of those.
func TestIntegrationListKeys_ServesTheProjection(t *testing.T) {
	helper := setupTest(t)
	client := dashboardClient(t, helper)
	namespace := adminNamespace(helper)

	require.NoError(t, createDashboard(t, client, "keys-aaa", "A"))
	require.NoError(t, createDashboard(t, client, "keys-bbb", "B"))

	rsp := apis.DoRequest(helper, apis.RequestParams{
		Method: http.MethodPost,
		Path:   namespacedPath(namespace),
		User:   helper.Org1.Admin,
		Body:   []byte(`{}`),
	}, &metav1.PartialObjectMetadataList{})

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
	require.NotNil(t, rsp.Result)

	assert.Equal(t, listKind, rsp.Result.Kind)
	assert.Equal(t, "meta.k8s.io/v1", rsp.Result.APIVersion)
	assert.NotEmpty(t, rsp.Result.ResourceVersion, "the snapshot version is what callers arbitrate races with")

	got := map[string]string{}
	for _, item := range rsp.Result.Items {
		got[item.Name] = item.Namespace
		assert.NotEmpty(t, item.ResourceVersion, "the per-key version is the whole point")
	}
	assert.Equal(t, namespace, got["keys-aaa"])
	assert.Equal(t, namespace, got["keys-bbb"])

	// No object body travels.
	assert.NotContains(t, string(rsp.Body), `"spec"`)
}

func TestIntegrationListKeys_RefusesInvalidRequests(t *testing.T) {
	helper := setupTest(t)
	namespace := adminNamespace(helper)

	for name, tc := range map[string]struct {
		method     string
		path       string
		body       string
		wantStatus int
		wantInBody string
	}{
		// Spans every namespace, so service-identity only.
		"cluster-wide refuses a user": {
			method: http.MethodPost, path: clusterPath(), body: `{}`,
			wantStatus: http.StatusForbidden,
		},
		// Dropping it silently would return an unfiltered list.
		"a selector is refused by name": {
			method: http.MethodPost, path: namespacedPath(namespace), body: `{"labelSelector":"team=a"}`,
			wantStatus: http.StatusBadRequest, wantInBody: "labelSelector",
		},
		"a field the endpoint does not read is refused": {
			method: http.MethodPost, path: namespacedPath(namespace), body: `{"shardSelector":"shard-1"}`,
			wantStatus: http.StatusBadRequest, wantInBody: "shardSelector",
		},
		"an unknown field is refused": {
			method: http.MethodPost, path: namespacedPath(namespace), body: `{"nonsense":true}`,
			wantStatus: http.StatusBadRequest,
		},
		// Parses, but backends read <= 0 as unset and serve the latest.
		"a negative resourceVersion is refused": {
			method: http.MethodPost, path: namespacedPath(namespace), body: `{"resourceVersion":"-1"}`,
			wantStatus: http.StatusBadRequest,
		},
		// Resolves to the object handler, so 404 with no such object.
		"GET does not serve keys": {
			method: http.MethodGet, path: namespacedPath(namespace),
			wantStatus: http.StatusNotFound,
		},
	} {
		t.Run(name, func(t *testing.T) {
			code, body := request(t, helper, tc.method, tc.path, tc.body)
			require.Equal(t, tc.wantStatus, code, body)
			if tc.wantInBody != "" {
				assert.Contains(t, body, tc.wantInBody)
			}
			assert.NotContains(t, body, listKind, "a refused request must not serve keys")
		})
	}
}

// The name is reserved, so the route can never be shadowed by an object. POST-only
// means it would not be today, but reserving keeps it consistent with search and
// trash and safe if a POST is ever registered on {resource}/{name}.
func TestIntegrationListKeys_NameIsReserved(t *testing.T) {
	helper := setupTest(t)
	client := dashboardClient(t, helper)

	err := createDashboard(t, client, utils.ListKeysPathSegment, "shadows the route")
	require.Error(t, err, "saving an object named %q must be refused", utils.ListKeysPathSegment)
	assert.Contains(t, err.Error(), "reserved", "it must be refused for being reserved, not for some other reason")
}

// Otherwise the endpoint works but is absent from generated clients.
func TestIntegrationListKeys_IsAdvertisedInTheSpec(t *testing.T) {
	helper := setupTest(t)
	paths := servedSpecPaths(t, helper)

	for name, want := range map[string]string{
		"cluster-wide": clusterPath(),
		"namespaced":   namespacedPath("{namespace}"),
	} {
		t.Run(name, func(t *testing.T) {
			entry, found := paths[want]
			require.True(t, found, "served spec is missing %s", want)

			ops, ok := entry.(map[string]any)
			require.True(t, ok)
			assert.Contains(t, ops, "post", "%s must be a POST", want)
			assert.NotContains(t, ops, "get", "%s must not offer GET", want)
		})
	}
}

// Routes and spec come from one slice, so off must mean absent at both.
func TestIntegrationListKeys_AbsentWhenDisabled(t *testing.T) {
	helper := setupWithoutKeysAPI(t)
	namespace := adminNamespace(helper)

	t.Run("the endpoint does not serve keys", func(t *testing.T) {
		code, body := request(t, helper, http.MethodPost, namespacedPath(namespace), `{}`)
		assert.NotEqual(t, http.StatusOK, code, body)
		assert.NotContains(t, body, listKind)
	})

	t.Run("the spec does not advertise it", func(t *testing.T) {
		for _, path := range []string{clusterPath(), namespacedPath("{namespace}")} {
			assert.NotContains(t, servedSpecPaths(t, helper), path)
		}
	})
}

// Tests the cluster-wide route via handler and not over HTTP because service identity is an
// in-process requester only.
func TestIntegrationListKeys_ClusterWideSpansNamespaces(t *testing.T) {
	helper := setupTest(t)

	org1, orgB := adminNamespace(helper), helper.OrgB.Admin.Identity.GetNamespace()
	require.NotEqual(t, org1, orgB, "the test only proves anything across two namespaces")

	require.NoError(t, createDashboard(t, dashboardClient(t, helper), "keys-org1", "A"))
	require.NoError(t, createDashboard(t, orgBDashboardClient(t, helper), "keys-orgb", "B"))

	handler := keysapi.NewHandler(helper.GetEnv().ResourceClient, noop.NewTracerProvider().Tracer("test")).
		ListKeysRoute(gvr.Group, gvr.Version, gvr.Resource, "Dashboard").Handler

	req := httptest.NewRequest(http.MethodPost, clusterPath(), strings.NewReader(`{}`))
	req = req.WithContext(identity.WithServiceIdentityContext(t.Context(), 1))
	rec := httptest.NewRecorder()
	handler(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var list metav1.PartialObjectMetadataList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	assert.Equal(t, listKind, list.Kind)

	got := map[string]string{}
	for _, item := range list.Items {
		got[item.Name] = item.Namespace
	}
	assert.Equal(t, org1, got["keys-org1"])
	assert.Equal(t, orgB, got["keys-orgb"], "a pinned namespace would serve only one org")
}

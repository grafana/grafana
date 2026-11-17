package provisioning

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/setting"
)

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

// stubRouter publishes one app manifest that opts the Widget kind in to provisioning, and it
// serves that kind. It records the access token of each request by path.
type stubRouter struct {
	*httptest.Server
	mu     sync.Mutex
	tokens map[string]string
}

func (r *stubRouter) accessToken(path string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.tokens[path]
}

func newStubRouter(t *testing.T) *stubRouter {
	t.Helper()
	served, enabled := true, true
	responses := map[string]any{
		"/apis/discovery/v1alpha2/manifests": appmanifestv1alpha2.AppManifestList{
			TypeMeta: metav1.TypeMeta{APIVersion: appmanifestv1alpha2.GroupVersion.String(), Kind: "AppManifestList"},
			Items: []appmanifestv1alpha2.AppManifest{{
				TypeMeta:   metav1.TypeMeta{APIVersion: appmanifestv1alpha2.GroupVersion.String(), Kind: "AppManifest"},
				ObjectMeta: metav1.ObjectMeta{Name: stubRouterGroup},
				Spec: appmanifestv1alpha2.AppManifestSpec{
					AppName: "example",
					Group:   stubRouterGroup,
					Versions: []appmanifestv1alpha2.AppManifestManifestVersion{{
						Name:   "v1",
						Served: &served,
						Kinds: []appmanifestv1alpha2.AppManifestManifestVersionKind{{
							Kind:  "Widget",
							Scope: appmanifestv1alpha2.AppManifestManifestVersionKindScopeNamespaced,
							Extensions: &appmanifestv1alpha2.AppManifestManifestVersionKindExtensions{
								Provisioning: &appmanifestv1alpha2.AppManifestManifestVersionKindProvisioning{Enabled: &enabled},
							},
						}},
					}},
				},
			}},
		},
		"/apis/" + stubRouterGroup + "/v1": metav1.APIResourceList{
			TypeMeta:     metav1.TypeMeta{APIVersion: "v1", Kind: "APIResourceList"},
			GroupVersion: stubRouterGroup + "/v1",
			APIResources: []metav1.APIResource{{Name: "widgets", SingularName: "widget", Namespaced: true, Kind: "Widget", Verbs: metav1.Verbs{"get", "list"}}},
		},
		"/apis/" + stubRouterGroup + "/v1/namespaces/default/widgets": map[string]any{
			"apiVersion": stubRouterGroup + "/v1", "kind": "WidgetList", "metadata": map[string]any{}, "items": []any{},
		},
	}

	router := &stubRouter{tokens: map[string]string{}}
	router.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response, ok := responses[r.URL.Path]
		if !ok {
			t.Errorf("unexpected router request: %s", r.URL)
			http.NotFound(w, r)
			return
		}
		router.mu.Lock()
		router.tokens[r.URL.Path] = r.Header.Get("X-Access-Token")
		router.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	t.Cleanup(router.Close)
	return router
}

func groupKinds(supported []resources.SupportedResource) []schema.GroupKind {
	kinds := make([]schema.GroupKind, 0, len(supported))
	for _, r := range supported {
		kinds = append(kinds, r.GroupKind)
	}
	return kinds
}

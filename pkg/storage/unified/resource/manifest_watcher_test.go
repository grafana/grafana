package resource

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	authn "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"
)

type fakeTokenExchanger struct {
	token  string
	gotReq *authn.TokenExchangeRequest
}

func (f *fakeTokenExchanger) Exchange(_ context.Context, req authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	f.gotReq = &req
	return &authn.TokenExchangeResponse{Token: f.token}, nil
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// The app-platform apiserver authenticates a standard bearer token, so the
// watcher's transport must send the exchanged token in Authorization, not the
// authlib X-Access-Token header (which the server ignores, yielding anonymous).
func TestManifestWatcher_AuthUsesAuthorizationHeader(t *testing.T) {
	exchanger := &fakeTokenExchanger{token: "exchanged-token"}

	var authorization, accessToken string
	base := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		authorization = r.Header.Get("Authorization")
		accessToken = r.Header.Get("X-Access-Token")
		rr := httptest.NewRecorder()
		rr.WriteHeader(http.StatusOK)
		return rr.Result(), nil
	})

	req, _ := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://example.org", nil)
	resp, err := manifestAuthWrapper(exchanger)(base).RoundTrip(req)
	require.NoError(t, err)
	_ = resp.Body.Close()

	require.Equal(t, "Bearer exchanged-token", authorization)
	require.Empty(t, accessToken)
	require.NotNil(t, exchanger.gotReq)
	require.Equal(t, []string{appManifestGVR.Group}, exchanger.gotReq.Audiences)
	require.Equal(t, clientauth.WildcardNamespace, exchanger.gotReq.Namespace)
}

// testAppManifestObj builds an unstructured AppManifest (v1alpha2) with one
// version declaring a single kind and the given search fields.
func testAppManifestObj(name, appName, group, kind string, searchFields ...string) *unstructured.Unstructured {
	sfs := make([]interface{}, 0, len(searchFields))
	for _, f := range searchFields {
		sfs = append(sfs, map[string]interface{}{"name": f, "type": "string"})
	}
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]interface{}{"name": name},
		"spec": map[string]interface{}{
			"appName": appName,
			"group":   group,
			"versions": []interface{}{
				map[string]interface{}{
					"name":   "v1",
					"served": true,
					"kinds": []interface{}{
						map[string]interface{}{
							"kind":         kind,
							"plural":       strings.ToLower(kind) + "s",
							"searchFields": sfs,
						},
					},
				},
			},
		},
	}}
}

func fakeManifestClient(objs ...runtime.Object) *dynamicfake.FakeDynamicClient {
	scheme := runtime.NewScheme()
	gvrToListKind := map[schema.GroupVersionResource]string{
		appManifestGVR: "AppManifestList",
	}
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, gvrToListKind, objs...)
}

func TestManifestWatcher_PollConvertsManifests(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
		testAppManifestObj("m-folders", "folders", "folder.grafana.app", "Folder", "title"),
	)

	w := newManifestWatcher(client, 0, nil, nil)
	w.runPollCycle(t.Context())

	got := w.Manifests()
	require.Len(t, got, 2)
	groups := map[string]bool{}
	for _, m := range got {
		require.NotNil(t, m.ManifestData)
		groups[m.ManifestData.Group] = true
	}
	require.True(t, groups["dashboard.grafana.app"])
	require.True(t, groups["folder.grafana.app"])
}

func TestManifestWatcher_OnChangeFiresOnlyWhenChanged(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)

	var calls int
	var last []app.Manifest
	w := newManifestWatcher(client, 0, func(m []app.Manifest) {
		calls++
		last = m
	}, nil)

	// First poll establishes the set and notifies.
	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)
	require.Len(t, last, 1)

	// Second poll over the same data must not notify again.
	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)
}

func TestManifestWatcher_ListErrorKeepsPreviousSet(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher(client, 0, nil, nil)
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)

	// Make the next list fail; the previous snapshot must survive.
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("apiserver down")
	})
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
}

func TestManifestWatcher_EmptyListKeepsPreviousSet(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher(client, 0, nil, nil)
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)

	// An empty result must not blank the live set.
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &unstructured.UnstructuredList{}, nil
	})
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
}

func TestManifestWatcher_PicksUpChangesOnNextPoll(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	var calls int
	w := newManifestWatcher(client, 0, func([]app.Manifest) { calls++ }, nil)

	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
	require.Equal(t, 1, calls)

	// A new manifest appears; the next poll must pick it up and notify again.
	require.NoError(t, client.Tracker().Add(
		testAppManifestObj("m-folders", "folders", "folder.grafana.app", "Folder", "title"),
	))
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 2)
	require.Equal(t, 2, calls)
}

func TestManifestWatcher_KeepsPreviousManifestOnParseFailure(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher(client, 0, nil, nil)
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)

	// The same object comes back broken (no spec). Because we already know it,
	// the previous version is kept rather than dropped.
	broken := unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]interface{}{"name": "m-dashboards"},
	}}
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &unstructured.UnstructuredList{Items: []unstructured.Unstructured{broken}}, nil
	})
	w.runPollCycle(t.Context())

	got := w.Manifests()
	require.Len(t, got, 1)
	require.Equal(t, "dashboard.grafana.app", got[0].ManifestData.Group)
}

func TestManifestWatcher_KeepPreviousSurvivesRename(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("A", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	var calls int
	w := newManifestWatcher(client, 0, func([]app.Manifest) { calls++ }, nil)
	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)

	// The same spec reappears under a new object name (rename). Content is
	// unchanged, so onChange must not fire, but the index must track the new name.
	renamed := testAppManifestObj("B", "dashboards", "dashboard.grafana.app", "Dashboard", "title")
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &unstructured.UnstructuredList{Items: []unstructured.Unstructured{*renamed}}, nil
	})
	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)

	// "B" now fails to convert; keep-previous must retain it via the current key.
	broken := unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]interface{}{"name": "B"},
	}}
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &unstructured.UnstructuredList{Items: []unstructured.Unstructured{broken}}, nil
	})
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
}

func TestManifestWatcher_SkipsManifestThatFailsToConvert(t *testing.T) {
	bad := &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "apps.grafana.app/v1alpha2",
		"kind":       "AppManifest",
		"metadata":   map[string]interface{}{"name": "m-bad"},
		// no spec
	}}
	client := fakeManifestClient(
		bad,
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher(client, 0, nil, nil)
	w.runPollCycle(t.Context())

	got := w.Manifests()
	require.Len(t, got, 1)
	require.Equal(t, "dashboard.grafana.app", got[0].ManifestData.Group)
}

func TestNewManifestWatcherConfig(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		sec, err := cfg.Raw.NewSection("grpc_client_authentication")
		require.NoError(t, err)
		_, err = sec.NewKey("token", "tok")
		require.NoError(t, err)
		_, err = sec.NewKey("token_exchange_url", "http://exchange")
		require.NoError(t, err)
		return cfg
	}

	t.Run("nil when address missing", func(t *testing.T) {
		require.Nil(t, NewManifestWatcherConfig(newCfg()))
	})

	t.Run("nil config returns nil", func(t *testing.T) {
		require.Nil(t, NewManifestWatcherConfig(nil))
	})

	t.Run("configured when all set", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestApiServerAddress = "https://apiserver"
		cfg.ManifestWatcherPollInterval = 5 * time.Minute
		wc := NewManifestWatcherConfig(cfg)
		require.NotNil(t, wc)
		require.Equal(t, "https://apiserver", wc.APIServerURL)
		require.Equal(t, "tok", wc.Token)
		require.Equal(t, "http://exchange", wc.TokenExchangeURL)
		require.Equal(t, 5*time.Minute, wc.PollInterval)
	})

	t.Run("insecure TLS ignored outside development", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestApiServerAddress = "https://apiserver"
		cfg.ManifestWatcherAllowInsecureTLS = true
		cfg.Env = setting.Prod
		wc := NewManifestWatcherConfig(cfg)
		require.NotNil(t, wc)
		require.False(t, wc.AllowInsecure)
	})
}

package resource

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	authn "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"
	"k8s.io/client-go/transport"
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
		AppManifestGVR: "AppManifestList",
	}
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, gvrToListKind, objs...)
}

func appManifestSources(client dynamic.Interface) []manifestSource {
	return []manifestSource{dynamicManifestSource(manifestSourceAppManifests, client, AppManifestGVR)}
}

// fakeDiscoveryClient serves the router's discovery list through a reactor:
// the fake tracker files objects by their own kind, so it can't hold them under
// the discovery resource.
func fakeDiscoveryClient(list func() (*unstructured.UnstructuredList, error)) *dynamicfake.FakeDynamicClient {
	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		ManifestDiscoveryGVR: "AppManifestList",
	})
	client.PrependReactor("list", ManifestDiscoveryGVR.Resource, func(k8stesting.Action) (bool, runtime.Object, error) {
		l, err := list()
		if err != nil {
			return true, nil, err
		}
		return true, l, nil
	})
	return client
}

func discoveryList(objs ...*unstructured.Unstructured) *unstructured.UnstructuredList {
	l := &unstructured.UnstructuredList{}
	for _, o := range objs {
		l.Items = append(l.Items, *o)
	}
	return l
}

func bothSources(discovery, appmanifests dynamic.Interface) []manifestSource {
	return []manifestSource{
		dynamicManifestSource(manifestSourceDiscovery, discovery, ManifestDiscoveryGVR),
		dynamicManifestSource(manifestSourceAppManifests, appmanifests, AppManifestGVR),
	}
}

// Each source sends the exchanged token where its server reads it, for that
// server's audience: the app-platform apiserver authenticates a standard bearer
// token in Authorization (it ignores X-Access-Token, yielding anonymous), while
// the router reads the authlib X-Access-Token header.
func TestManifestWatcher_AuthHeaders(t *testing.T) {
	for name, tc := range map[string]struct {
		wrap          func(authn.TokenExchanger) transport.WrapperFunc
		header, unset string
		audience      string
	}{
		"appmanifests": {wrap: manifestAuthWrapper, header: "Authorization", unset: "X-Access-Token", audience: AppManifestGVR.Group},
		"discovery": {
			wrap:   func(e authn.TokenExchanger) transport.WrapperFunc { return discoveryAuthWrapper(e, "router-audience") },
			header: "X-Access-Token", unset: "Authorization", audience: "router-audience",
		},
	} {
		t.Run(name, func(t *testing.T) {
			exchanger := &fakeTokenExchanger{token: "exchanged-token"}
			var got http.Header
			base := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
				got = r.Header.Clone()
				rr := httptest.NewRecorder()
				rr.WriteHeader(http.StatusOK)
				return rr.Result(), nil
			})

			req, _ := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://example.org", nil)
			resp, err := tc.wrap(exchanger)(base).RoundTrip(req)
			require.NoError(t, err)
			_ = resp.Body.Close()

			require.Equal(t, "Bearer exchanged-token", got.Get(tc.header))
			require.Empty(t, got.Get(tc.unset))
			require.NotNil(t, exchanger.gotReq)
			require.Equal(t, []string{tc.audience}, exchanger.gotReq.Audiences)
			require.Equal(t, clientauth.WildcardNamespace, exchanger.gotReq.Namespace)
		})
	}
}

func TestManifestWatcher_PrefersDiscovery(t *testing.T) {
	discovery := fakeDiscoveryClient(func() (*unstructured.UnstructuredList, error) {
		return discoveryList(testAppManifestObj("folder.grafana.app", "folders", "folder.grafana.app", "Folder", "title")), nil
	})
	appmanifests := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher(bothSources(discovery, appmanifests), 0, nil, nil, prometheus.NewPedanticRegistry())
	w.runPollCycle(t.Context())

	got := w.Manifests()
	require.Len(t, got, 1)
	require.Equal(t, "folder.grafana.app", got[0].Group)
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.sourcePolls.WithLabelValues(manifestSourceDiscovery, "success")))
	for _, a := range appmanifests.Actions() {
		require.NotEqual(t, "list", a.GetVerb(), "the apiserver must not be asked when discovery answers")
	}
}

func TestManifestWatcher_FallsBackFromDiscovery(t *testing.T) {
	for name, list := range map[string]func() (*unstructured.UnstructuredList, error){
		// A router without the endpoint yet answers 404.
		"error": func() (*unstructured.UnstructuredList, error) {
			return nil, apierrors.NewNotFound(schema.GroupResource{Group: "discovery", Resource: "manifests"}, "")
		},
		"empty": func() (*unstructured.UnstructuredList, error) { return discoveryList(), nil },
	} {
		t.Run(name, func(t *testing.T) {
			appmanifests := fakeManifestClient(
				testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
			)
			w := newManifestWatcher(bothSources(fakeDiscoveryClient(list), appmanifests), 0, nil, nil, prometheus.NewPedanticRegistry())
			w.runPollCycle(t.Context())

			got := w.Manifests()
			require.Len(t, got, 1)
			require.Equal(t, "dashboard.grafana.app", got[0].Group)
			require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.sourcePolls.WithLabelValues(manifestSourceDiscovery, name)))
			require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.sourcePolls.WithLabelValues(manifestSourceAppManifests, "success")))
			require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.polls.WithLabelValues("success")))
		})
	}
}

func TestManifestWatcher_AllSourcesFailKeepsPreviousSet(t *testing.T) {
	fail := false
	discovery := fakeDiscoveryClient(func() (*unstructured.UnstructuredList, error) {
		if fail {
			return nil, errors.New("router down")
		}
		return discoveryList(testAppManifestObj("dashboard.grafana.app", "dashboards", "dashboard.grafana.app", "Dashboard", "title")), nil
	})
	appmanifests := fakeManifestClient()
	appmanifests.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("apiserver down")
	})
	w := newManifestWatcher(bothSources(discovery, appmanifests), 0, nil, nil, prometheus.NewPedanticRegistry())
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)

	fail = true
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.polls.WithLabelValues("error")))
}

// Discovery names manifests by group and leaves out Operator and
// ExtraPermissions; moving between sources with the same search content must
// not publish, or every flap would force a reindex.
func TestManifestWatcher_SwitchingSourcesDoesNotRepublish(t *testing.T) {
	withOperator := func(o *unstructured.Unstructured) *unstructured.Unstructured {
		o.Object["spec"].(map[string]interface{})["operator"] = map[string]interface{}{"url": "https://operator"}
		return o
	}
	discoveryUp := false
	discovery := fakeDiscoveryClient(func() (*unstructured.UnstructuredList, error) {
		if !discoveryUp {
			return nil, errors.New("not found")
		}
		return discoveryList(
			testAppManifestObj("dashboard.grafana.app", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
			testAppManifestObj("folder.grafana.app", "folders", "folder.grafana.app", "Folder", "title"),
		), nil
	})
	// Object names sort the other way from their groups.
	appmanifests := fakeManifestClient(
		withOperator(testAppManifestObj("a-folders", "folders", "folder.grafana.app", "Folder", "title")),
		withOperator(testAppManifestObj("b-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title")),
	)
	var calls int
	w := newManifestWatcher(bothSources(discovery, appmanifests), 0, func([]*app.ManifestData) { calls++ }, nil, nil)

	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)
	require.Nil(t, w.Manifests()[0].Operator)

	discoveryUp = true
	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)

	discoveryUp = false
	w.runPollCycle(t.Context())
	require.Equal(t, 1, calls)
}

func TestManifestWatcher_SwitchingSourcesRequiresCompleteConversion(t *testing.T) {
	discoveryItems := discoveryList(
		testAppManifestObj("dashboard.grafana.app", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
		testAppManifestObj("folder.grafana.app", "folders", "folder.grafana.app", "Folder", "title"),
	)
	// Names can overlap across sources without referring to the same group.
	legacyItems := discoveryList(
		testAppManifestObj("folder.grafana.app", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
		testAppManifestObj("dashboard.grafana.app", "folders", "folder.grafana.app", "Folder", "title"),
	)
	discoveryErr := errors.New("discovery not deployed")
	discovery := fakeDiscoveryClient(func() (*unstructured.UnstructuredList, error) {
		return discoveryItems, discoveryErr
	})
	var legacyErr error
	legacy := fakeManifestClient()
	legacy.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, legacyItems, legacyErr
	})
	reg := prometheus.NewPedanticRegistry()
	var reloads int
	w := newManifestWatcher(bothSources(discovery, legacy), 0, func([]*app.ManifestData) { reloads++ }, nil, reg)
	w.runPollCycle(t.Context())
	expected := w.Manifests()
	require.Len(t, expected, 2)
	require.Equal(t, 1, reloads)

	discoveryErr = nil
	dashboardSpec := discoveryItems.Items[0].Object["spec"]
	delete(discoveryItems.Items[0].Object, "spec")
	w.runPollCycle(t.Context())
	require.Equal(t, expected, w.Manifests(), "an incomplete new source must fall back")
	require.Equal(t, 1, reloads)
	require.Equal(t, float64(2), testutil.ToFloat64(w.metrics.sourcePolls.WithLabelValues(manifestSourceDiscovery, "error")))
	require.Equal(t, float64(2), testutil.ToFloat64(w.metrics.sourcePolls.WithLabelValues(manifestSourceAppManifests, "success")))

	legacyErr = errors.New("apiserver unavailable")
	w.runPollCycle(t.Context())
	require.Equal(t, expected, w.Manifests(), "keep the snapshot when fallback also fails")
	require.Equal(t, 1, reloads)

	discoveryItems.Items[0].Object["spec"] = dashboardSpec
	w.runPollCycle(t.Context())
	require.Equal(t, expected, w.Manifests())
	require.Equal(t, 1, reloads, "switching to equivalent discovery data must not reload")

	delete(discoveryItems.Items[0].Object, "spec")
	w.runPollCycle(t.Context())
	require.Equal(t, expected, w.Manifests(), "same-source recovery still works after a switch without a reload")
	require.Equal(t, 1, reloads)

	discoveryErr = errors.New("router unavailable")
	legacyErr = nil
	legacySpec := legacyItems.Items[0].Object["spec"]
	delete(legacyItems.Items[0].Object, "spec")
	w.runPollCycle(t.Context())
	require.Equal(t, expected, w.Manifests(), "switching back must also require a complete conversion")
	require.Equal(t, 1, reloads)

	legacyItems.Items[0].Object["spec"] = legacySpec
	w.runPollCycle(t.Context())
	require.Equal(t, expected, w.Manifests())
	require.Equal(t, 1, reloads)
	_, err := reg.Gather()
	require.NoError(t, err)
}

func TestManifestWatcher_PollConvertsManifests(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
		testAppManifestObj("m-folders", "folders", "folder.grafana.app", "Folder", "title"),
	)

	w := newManifestWatcher(appManifestSources(client), 0, nil, nil, nil)
	w.runPollCycle(t.Context())

	got := w.Manifests()
	require.Len(t, got, 2)
	groups := map[string]bool{}
	for _, m := range got {
		require.NotNil(t, m)
		groups[m.Group] = true
	}
	require.True(t, groups["dashboard.grafana.app"])
	require.True(t, groups["folder.grafana.app"])
}

func TestManifestWatcher_OnChangeFiresOnlyWhenChanged(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)

	var calls int
	var last []*app.ManifestData
	w := newManifestWatcher(appManifestSources(client), 0, func(m []*app.ManifestData) {
		calls++
		last = m
	}, nil, nil)

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
	w := newManifestWatcher(appManifestSources(client), 0, nil, nil, nil)
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
	w := newManifestWatcher(appManifestSources(client), 0, nil, nil, nil)
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)

	// An empty result must not blank the live set.
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, &unstructured.UnstructuredList{}, nil
	})
	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
}

func TestManifestWatcher_RecordsMetrics(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher(appManifestSources(client), 0, nil, nil, prometheus.NewPedanticRegistry())

	// First poll: one successful poll, one reload, one manifest, a fresh timestamp.
	w.runPollCycle(t.Context())
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.polls.WithLabelValues("success")))
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.reloads))
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.manifests))
	require.Positive(t, testutil.ToFloat64(w.metrics.lastSuccess))

	// Unchanged data: another successful poll, but no new reload.
	w.runPollCycle(t.Context())
	require.Equal(t, float64(2), testutil.ToFloat64(w.metrics.polls.WithLabelValues("success")))
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.reloads))

	// A list failure increments the error label and leaves reloads untouched.
	client.PrependReactor("list", "appmanifests", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("apiserver down")
	})
	w.runPollCycle(t.Context())
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.polls.WithLabelValues("error")))
	require.Equal(t, float64(1), testutil.ToFloat64(w.metrics.reloads))
}

func TestManifestWatcher_PicksUpChangesOnNextPoll(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	var calls int
	w := newManifestWatcher(appManifestSources(client), 0, func([]*app.ManifestData) { calls++ }, nil, nil)

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
	w := newManifestWatcher(appManifestSources(client), 0, nil, nil, nil)
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
	require.Equal(t, "dashboard.grafana.app", got[0].Group)
}

func TestManifestWatcher_KeepPreviousSurvivesRename(t *testing.T) {
	client := fakeManifestClient(
		testAppManifestObj("A", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	var calls int
	w := newManifestWatcher(appManifestSources(client), 0, func([]*app.ManifestData) { calls++ }, nil, nil)
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
	w := newManifestWatcher(appManifestSources(client), 0, nil, nil, nil)
	w.runPollCycle(t.Context())

	got := w.Manifests()
	require.Len(t, got, 1)
	require.Equal(t, "dashboard.grafana.app", got[0].Group)
}

func TestManifestFromUnstructured_PreservesEmbeddingVersions(t *testing.T) {
	obj := testAppManifestObj("m-foos", "foos", "foo.grafana.app", "Foo")
	spec := obj.Object["spec"].(map[string]interface{})
	spec["embed"] = map[string]interface{}{"foos": map[string]interface{}{"reembedVersion": int64(3)}}
	spec["versions"] = []interface{}{
		map[string]interface{}{
			"name": "v2", "served": true,
			"kinds": []interface{}{map[string]interface{}{
				"kind": "Foo", "embed": map[string]interface{}{"fields": []interface{}{
					map[string]interface{}{"name": "title", "path": "spec.title"},
					map[string]interface{}{"name": "description", "path": "spec.description"},
				}},
			}},
		},
		map[string]interface{}{
			"name": "v1", "served": false,
			"kinds": []interface{}{map[string]interface{}{
				"kind": "Foo", "embed": map[string]interface{}{"fields": []interface{}{
					map[string]interface{}{"name": "title", "path": "spec.oldTitle"},
				}},
			}},
		},
	}
	before := obj.DeepCopy()

	data, err := ManifestFromUnstructured(obj)
	require.NoError(t, err)
	require.Equal(t, map[string]app.ManifestResourceEmbed{"foos": {ReembedVersion: 3}}, data.Embed)
	require.Len(t, data.Versions, 2)
	require.Equal(t, "v2", data.Versions[0].Name)
	require.Equal(t, []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}, {Name: "description", Path: "spec.description"}}, data.Versions[0].Kinds[0].Embed.Fields)
	require.Equal(t, "v1", data.Versions[1].Name)
	require.False(t, data.Versions[1].Served)
	require.Equal(t, []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.oldTitle"}}, data.Versions[1].Kinds[0].Embed.Fields)
	require.Equal(t, before, obj)
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

	t.Run("configured with only the discovery endpoint", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestDiscoveryAddress = "https://router"
		cfg.ManifestDiscoveryAudience = "router-audience"
		wc := NewManifestWatcherConfig(cfg)
		require.NotNil(t, wc)
		require.Equal(t, "https://router", wc.DiscoveryURL)
		require.Equal(t, "router-audience", wc.DiscoveryAudience)
		require.Empty(t, wc.APIServerURL)
	})

	t.Run("discovery ignored without an audience", func(t *testing.T) {
		cfg := newCfg()
		cfg.ManifestDiscoveryAddress = "https://router"
		require.Nil(t, NewManifestWatcherConfig(cfg))

		cfg.ManifestApiServerAddress = "https://apiserver"
		wc := NewManifestWatcherConfig(cfg)
		require.NotNil(t, wc)
		require.Empty(t, wc.DiscoveryURL)
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

// A hung source must not use up the next source's time: each gets its own
// timeout, so the fallback still answers.
func TestManifestWatcher_HungSourceLeavesFallbackItsTime(t *testing.T) {
	hung := manifestSource{name: manifestSourceDiscovery, list: func(ctx context.Context) ([]listedManifest, error) {
		<-ctx.Done()
		return nil, ctx.Err()
	}}
	appmanifests := fakeManifestClient(
		testAppManifestObj("m-dashboards", "dashboards", "dashboard.grafana.app", "Dashboard", "title"),
	)
	w := newManifestWatcher([]manifestSource{hung, appManifestSources(appmanifests)[0]}, 0, nil, nil, nil)
	w.sourceTimeout = 50 * time.Millisecond

	w.runPollCycle(t.Context())
	require.Len(t, w.Manifests(), 1)
}

// While no source lists a set, the watcher keeps retrying at most once per
// poll interval, however long that lasts, and never spins.
func TestManifestWatcher_RetriesWithoutSpinningWhileEmpty(t *testing.T) {
	var polls atomic.Int64
	empty := manifestSource{name: manifestSourceDiscovery, list: func(context.Context) ([]listedManifest, error) {
		polls.Add(1)
		return nil, nil
	}}
	interval := 20 * time.Millisecond
	w := newManifestWatcher([]manifestSource{empty}, interval, nil, nil, nil)

	ctx, cancel := context.WithTimeout(t.Context(), 30*interval)
	defer cancel()
	require.NoError(t, w.running(ctx))
	require.Greater(t, polls.Load(), int64(5), "keeps retrying")
	require.LessOrEqual(t, polls.Load(), int64(31), "no faster than the poll interval")
}

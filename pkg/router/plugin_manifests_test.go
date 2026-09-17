package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// pluginManifestsFixture is a minimal instance of the response shape a real
// plugin-manifests operator emits at GET /plugins -- the
// {"key","plugins":[{"definition":{"jsonData","manifest"},"host"}]} envelope
// definition.PluginDeployments describes, confirmed against a live
// deployment (an earlier check against a stale pinned image wrongly found a
// bare-array mismatch; a fresher image returns exactly this shape).
const pluginManifestsFixture = `{
	"key": "2026-09-16T01:31:44Z",
	"plugins": [
		{
			"definition": {
				"jsonData": {"id": "grafana-appsdktest-app", "type": "app", "name": "Test App"},
				"manifest": {
					"appName": "grafana-appsdktest-app",
					"group": "appsdktest.ext.grafana.app",
					"versions": [{"name": "v1alpha1", "served": true}],
					"preferredVersion": "v1alpha1"
				}
			},
			"host": "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051"
		},
		{
			"definition": {
				"jsonData": {"id": "no-manifest-plugin", "type": "app", "name": "No Manifest"}
			}
		}
	]
}`

func TestFetchPluginManifests_DecodesDeploymentsEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	deployment, err := fetchPluginManifests(t.Context(), srv.Client(), srv.URL)
	require.NoError(t, err)
	require.Equal(t, "2026-09-16T01:31:44Z", deployment.Key)
	require.Len(t, deployment.Plugins, 2)

	first := deployment.Plugins[0]
	require.Equal(t, "grafana-appsdktest-app", first.Definition.JSONData.ID)
	require.NotNil(t, first.Definition.Manifest)
	require.Equal(t, "appsdktest.ext.grafana.app", first.Definition.Manifest.Group)
	require.Equal(t, "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051", first.Host)

	second := deployment.Plugins[1]
	require.Equal(t, "no-manifest-plugin", second.Definition.JSONData.ID)
	require.Nil(t, second.Definition.Manifest)
}

func TestPluginManifestsTarget_PollsFiltersAndSkipsEntriesWithoutManifest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	dirty := make(chan struct{}, 1)
	go target.run(ctx, dirty)
	defer cancel()

	require.Eventually(t, func() bool {
		return len(target.Backends()) == 1
	}, 2*time.Second, 10*time.Millisecond)

	backends := target.Backends()
	require.Equal(t, "appsdktest.ext.grafana.app", backends[0].Group().Name)
	require.Contains(t, backends[0].Key(), "plugins_url:grafana-appsdktest-app:")
}

func TestPluginManifestsTarget_GroupRegexNarrowsToMatchingGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	patterns, err := compileGroupPatterns([]string{"*.internal"})
	require.NoError(t, err)

	target, err := newPluginManifestsTarget(srv.URL, patterns, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	target.poll(t.Context(), make(chan struct{}, 1))
	require.Empty(t, target.Backends(), "appsdktest.ext.grafana.app must not match *.internal")
}

func TestPluginManifestsTarget_SignalsDirtyOnlyOnKeySetChange(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	ctx := t.Context()
	dirty := make(chan struct{}, 1)

	target.poll(ctx, dirty)
	require.Len(t, target.Backends(), 1)
	select {
	case <-dirty:
	default:
		t.Fatal("expected dirty to be signaled on the first poll (empty -> non-empty key set)")
	}

	target.poll(ctx, dirty)
	require.Len(t, target.Backends(), 1)
	select {
	case <-dirty:
		t.Fatal("dirty must not be signaled when the discovered key set is unchanged")
	default:
	}
}

func TestPluginManifestsTarget_FailedPollLeavesLastKnownGoodSnapshot(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)

	// Seed a snapshot as if a previous poll had succeeded, then confirm a
	// failed poll doesn't clear it -- same last-known-good invariant as
	// aggregateTarget.
	seeded := []Backend{&pluginDeploymentBackend{key: "seeded"}}
	target.snapshot.Store(&seeded)

	target.poll(t.Context(), make(chan struct{}, 1))
	require.Equal(t, seeded, target.Backends())
}

func TestNewPluginManifestsTarget_RejectsNonAbsoluteURL(t *testing.T) {
	for _, badURL := range []string{"", "/just/a/path", "plugins.example.invalid"} {
		t.Run(badURL, func(t *testing.T) {
			_, err := newPluginManifestsTarget(badURL, nil, http.DefaultClient, PluginDependencies{})
			require.ErrorContains(t, err, "must be absolute")
		})
	}
}

func TestPluginManifestsTargetReloadsOnHostChange(t *testing.T) {
	body := pluginManifestsFixture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()
	target, err := newPluginManifestsTarget(srv.URL, nil, srv.Client(), PluginDependencies{})
	require.NoError(t, err)
	dirty := make(chan struct{}, 1)
	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	first := target.Backends()[0]
	<-dirty
	body = strings.ReplaceAll(body, "grafana-appsdktest-app-operator.grafana-router-plugins.svc.cluster.local.:50051", "replacement:50051")
	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	second := target.Backends()[0]
	require.NotEqual(t, first.Key(), second.Key())
	require.Len(t, dirty, 1)
}

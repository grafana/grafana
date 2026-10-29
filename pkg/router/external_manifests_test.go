package router

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/setting"
)

// fakeExternalSource is an ExternalManifestSource that serves what the test sets.
type fakeExternalSource struct {
	mu      sync.Mutex
	entries []ExternalManifest
	err     error
	calls   int
	changed chan struct{}
}

func (s *fakeExternalSource) set(entries []ExternalManifest, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries, s.err = entries, err
}

func (s *fakeExternalSource) Manifests(context.Context) ([]ExternalManifest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	return s.entries, s.err
}

func (s *fakeExternalSource) Notify() <-chan struct{} { return s.changed }

func externalTestManifest(group, plural string) *app.ManifestData {
	return &app.ManifestData{
		AppName: "widgets",
		Group:   group,
		Versions: []app.ManifestVersion{{
			Name:   "v0alpha1",
			Served: true,
			Kinds:  []app.ManifestVersionKind{{Kind: "Widget", Plural: plural, Scope: "Namespaced"}},
		}},
	}
}

func newTestExternalManifests(t *testing.T, source ExternalManifestSource) *externalManifests {
	t.Helper()
	e, err := newExternalManifests(setting.NewCfg(), PluginDependencies{ExternalManifests: source})
	require.NoError(t, err)
	require.NotNil(t, e)
	t.Cleanup(e.conns.closeConnections)
	return e
}

func TestNewExternalManifestsWithoutSource(t *testing.T) {
	e, err := newExternalManifests(setting.NewCfg(), PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, e)
	require.Nil(t, e.backends(t.Context()), "a nil source serves nothing")
}

func TestExternalManifestsBackends(t *testing.T) {
	source := &fakeExternalSource{}
	source.set([]ExternalManifest{
		{Name: "http", Manifest: externalTestManifest("http.ext.grafana.app", "widgets"), Host: "http://127.0.0.1:8080"},
		{Name: "grpc", Manifest: externalTestManifest("grpc.ext.grafana.app", "widgets"), Host: "127.0.0.1:10000"},
		{Name: "storage-only", Manifest: externalTestManifest("storage.ext.grafana.app", "")},
		{Name: "Not_A_Name", Manifest: externalTestManifest("bad-name.ext.grafana.app", "widgets")},
		{Name: "no-manifest"},
		{Name: "core", Manifest: externalTestManifest("dashboard.grafana.app", "widgets")},
	}, nil)
	e := newTestExternalManifests(t, source)

	backends := e.backends(t.Context())
	require.Len(t, backends, 3, "invalid entries are skipped without failing the others")
	require.Equal(t, uint64(1), e.status.successes.Load())
	require.Equal(t, int64(3), e.status.skipped.Load())

	byGroup := map[string]*PluginBackend{}
	for _, b := range backends {
		require.Equal(t, sourceExternal, b.Source())
		require.True(t, strings.HasPrefix(b.Key(), externalKeyPrefix+":"), b.Key())
		byGroup[b.Group().Name] = b.(*pluginDeploymentBackend).Backend.(*PluginBackend)
	}
	require.Contains(t, backends[0].Key(), ":http:", "the name is part of the key")

	http := byGroup["http.ext.grafana.app"]
	require.Nil(t, http.acquire, "an HTTP operator holds no gRPC connection")
	require.True(t, http.hasBackend)
	_, clientV3, err := http.client(t.Context(), http.pluginID)
	require.NoError(t, err)
	require.NotNil(t, clientV3)

	grpc := byGroup["grpc.ext.grafana.app"]
	require.NotNil(t, grpc.acquire, "a gRPC backend holds its connection")
	release, err := grpc.acquire()
	require.NoError(t, err)
	release()

	storage := byGroup["storage.ext.grafana.app"]
	require.False(t, storage.hasBackend)
	require.Equal(t, "widgets", storage.manifest.Versions[0].Kinds[0].Plural,
		"a kind without a plural gets the one apiextensions stores it under")
	_, ok := storage.PluginStatus()
	require.False(t, ok, "an external manifest serves no plugin")
}

func TestExternalManifestsKeyChangesWithHost(t *testing.T) {
	manifest := externalTestManifest("widgets.ext.grafana.app", "widgets")
	first, err := externalManifestKey("widgets", manifest, "http://127.0.0.1:8080")
	require.NoError(t, err)
	second, err := externalManifestKey("widgets", manifest, "http://127.0.0.1:8081")
	require.NoError(t, err)
	require.NotEqual(t, first, second)
}

func TestExternalManifestsServeLastSetOnError(t *testing.T) {
	source := &fakeExternalSource{}
	source.set([]ExternalManifest{{Name: "widgets", Manifest: externalTestManifest("widgets.ext.grafana.app", "widgets")}}, nil)
	e := newTestExternalManifests(t, source)

	before := e.backends(t.Context())
	require.Len(t, before, 1)

	source.set(nil, errors.New("source unavailable"))
	after := e.backends(t.Context())
	require.Equal(t, before, after, "a failed read keeps serving the last set read")
	require.Equal(t, uint64(1), e.status.failures.Load())
}

func TestWithDefaultPluralsCopies(t *testing.T) {
	manifest := externalTestManifest("widgets.ext.grafana.app", "")
	out := withDefaultPlurals(manifest)
	require.Equal(t, "widgets", out.Versions[0].Kinds[0].Plural)
	require.Empty(t, manifest.Versions[0].Kinds[0].Plural, "the source's manifest is left as it was")

	explicit := withDefaultPlurals(externalTestManifest("widgets.ext.grafana.app", "Gizmos"))
	require.Equal(t, "Gizmos", explicit.Versions[0].Kinds[0].Plural, "an explicit plural is kept")
}

func TestExternalManifestsDeclareRoles(t *testing.T) {
	plugin := externalTestManifest("plugin.ext.grafana.app", "widgets")
	external := externalTestManifest("external.ext.grafana.app", "widgets")
	external.AppDisplayName = "External Widgets"
	source := &fakeExternalSource{}
	source.set([]ExternalManifest{
		{Name: "plugin", Manifest: plugin},
		{Name: "external", Manifest: external},
		{Name: "no-manifest"},
	}, nil)
	e := newTestExternalManifests(t, source)

	service := &recordingManifestRoleService{}
	e.declareRoles(t.Context(), service, map[string]struct{}{"plugin.ext.grafana.app": {}})
	require.Equal(t, 1, service.calls, "a group a local plugin serves keeps the plugin's roles")
	require.NotEmpty(t, service.roles)
	for _, role := range service.roles {
		require.True(t, strings.HasPrefix(role.Role.Name, "fixed:external.ext.grafana.app:"), role.Role.Name)
		require.Equal(t, "External Widgets", role.Role.Group)
	}

	// Neither a failed read nor a failed declaration is fatal: Grafana must still start.
	source.set(nil, errors.New("source unavailable"))
	e.declareRoles(t.Context(), service, nil)
	source.set([]ExternalManifest{{Name: "external", Manifest: external}}, nil)
	e.declareRoles(t.Context(), &recordingManifestRoleService{err: errors.New("role registration failed")}, nil)
}

func TestPluginLoaderServesExternalManifests(t *testing.T) {
	source := &fakeExternalSource{changed: make(chan struct{})}
	source.set([]ExternalManifest{{Name: "widgets", Manifest: externalTestManifest("widgets.ext.grafana.app", "widgets")}}, nil)
	loader, err := ProvideRoutesLoader(setting.NewCfg(), PluginLoaderDependencies{
		PluginDependencies: PluginDependencies{ExternalManifests: source},
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	dirty, err := loader.Notify(ctx)
	require.NoError(t, err)

	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 1)
	require.Equal(t, sourceExternal, backends[0].Source())

	source.changed <- struct{}{}
	select {
	case <-dirty:
	case <-time.After(5 * time.Second):
		t.Fatal("a source notification must wake the router")
	}
}

func TestPluginLoaderDevTargetsOverrideExternalManifests(t *testing.T) {
	cfg := devTestCfg(t, "[router.dev.widgets]\nmanifest = "+writeDevManifest(t, devTestManifest)+"\nhost = http://127.0.0.1:8080\n")
	source := &fakeExternalSource{}
	source.set([]ExternalManifest{{Name: "widgets", Manifest: externalTestManifest("widgets.ext.grafana.app", "widgets")}}, nil)
	loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{
		PluginDependencies: PluginDependencies{ExternalManifests: source},
	})
	require.NoError(t, err)

	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.Equal(t, sourceExternal, backends[0].Source())
	require.Equal(t, sourceDev, backends[1].Source(), "the dev target comes last, so it wins the group")
}

func TestExternalManifestsForwardEndsOnClose(t *testing.T) {
	source := &fakeExternalSource{changed: make(chan struct{})}
	e := newTestExternalManifests(t, source)
	done := make(chan struct{})
	go func() {
		e.forward(t.Context(), make(chan struct{}, 1))
		close(done)
	}()
	close(source.changed)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("a closed notify channel must end forwarding, not busy-loop")
	}
}

func TestCloudLoaderExternalManifestsOverrideAggregate(t *testing.T) {
	aggregateUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{{Name: "widgets.ext.grafana.app"}, {Name: "other.ext.grafana.app"}}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer aggregateUpstream.Close()

	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	addAggregateSection(t, cfg, "baas_apiserver", map[string]string{
		"url":            aggregateUpstream.URL,
		"discovery_auth": "none",
	})
	source := &fakeExternalSource{changed: make(chan struct{})}
	source.set([]ExternalManifest{{Name: "widgets", Manifest: externalTestManifest("widgets.ext.grafana.app", "widgets")}}, nil)

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{ExternalManifests: source})
	require.NoError(t, err)
	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	svc, ok := loaderIface.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})

	var backends []Backend
	require.Eventually(t, func() bool {
		backends, err = loader.Load(t.Context())
		return err == nil && len(backends) == 2
	}, 5*time.Second, 10*time.Millisecond)
	sources := map[string]string{}
	for _, b := range backends {
		sources[b.Group().Name] = b.Source()
	}
	require.Equal(t, sourceExternal, sources["widgets.ext.grafana.app"], "an external manifest takes over the group from the aggregate target")
	require.Equal(t, aggregateSource("baas_apiserver"), sources["other.ext.grafana.app"])
	require.Contains(t, loader.shadowedGroups(), shadowedGroup{
		Group: "widgets.ext.grafana.app", Source: aggregateSource("baas_apiserver"), By: sourceExternal,
	})

	var statuses []string
	for _, s := range loader.sourceStatuses() {
		statuses = append(statuses, s.Source)
	}
	require.Contains(t, statuses, sourceExternal)

	source.changed <- struct{}{}
	dirty, err := loader.Notify(t.Context())
	require.NoError(t, err)
	require.Eventually(t, func() bool {
		select {
		case <-dirty:
			return true
		default:
			return false
		}
	}, 5*time.Second, 10*time.Millisecond, "a source notification must wake the router")
}

func TestProvideCloudRoutesLoaderFactory_ExternalManifestsAloneActivate(t *testing.T) {
	loader, err := ProvideCloudRoutesLoaderFactory(cfgWithCloudRouterSection(t, map[string]string{}),
		PluginDependencies{ExternalManifests: &fakeExternalSource{}})
	require.NoError(t, err)
	require.IsType(t, &cloudLoader{}, loader)
}

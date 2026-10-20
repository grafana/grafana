package router

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
)

const testOwnerGroup = "gas.ext.grafana.app"

func TestParseNamespacedGroup(t *testing.T) {
	for _, tc := range []struct {
		group, owner    string
		name, namespace string
		wantErr         bool
	}{
		{group: "myapp.stacks-1.gas.ext.grafana.app", owner: testOwnerGroup, name: "myapp", namespace: "stacks-1"},
		{group: "my.app.default.gas.ext.grafana.app", owner: testOwnerGroup, name: "my.app", namespace: "default"},
		{group: "gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "stacks-1.gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: ".stacks-1.gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "myapp..gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "myapp.Stacks-1.gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "myapp.stacks_1.gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "myapp.stacks-1.other.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "myapp.stacks-1xgas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "my_app.stacks-1.gas.ext.grafana.app", owner: testOwnerGroup, wantErr: true},
		{group: "myapp.stacks-1.gas.ext.grafana.app", owner: "", wantErr: true},
	} {
		t.Run(tc.group, func(t *testing.T) {
			name, namespace, err := parseNamespacedGroup(tc.group, tc.owner)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.name, name)
			require.Equal(t, tc.namespace, namespace)
		})
	}
}

// fakeManifestsClient answers the _manifests route from pages, keyed by the
// continue token, and records each request.
type fakeManifestsClient struct {
	appclientv3.Client

	mu       sync.Mutex
	pages    map[string]namespacedManifestsPage
	status   int
	requests []*pluginv3.CallRouteRequest
	service  []bool // whether each request was made as the service identity
}

func (c *fakeManifestsClient) setPages(pages map[string]namespacedManifestsPage) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pages = pages
}

func (c *fakeManifestsClient) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.requests = append(c.requests, in)
	c.service = append(c.service, identity.IsServiceIdentity(ctx))

	res := &pluginv3.CallRouteResponse{}
	if c.status != 0 {
		res.SetCode(int32(c.status))
		return &fakeRouteStream{responses: []*pluginv3.CallRouteResponse{res}}, nil
	}
	u, err := url.Parse(in.GetUrl())
	if err != nil {
		return nil, err
	}
	page, ok := c.pages[u.Query().Get("continue")]
	if !ok {
		res.SetCode(http.StatusGone)
		return &fakeRouteStream{responses: []*pluginv3.CallRouteResponse{res}}, nil
	}
	body, err := json.Marshal(page)
	if err != nil {
		return nil, err
	}
	res.SetCode(http.StatusOK)
	res.SetBody(body)
	return &fakeRouteStream{responses: []*pluginv3.CallRouteResponse{res}}, nil
}

type fakeRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	responses []*pluginv3.CallRouteResponse
}

func (s *fakeRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	if len(s.responses) == 0 {
		return nil, io.EOF
	}
	res := s.responses[0]
	s.responses = s.responses[1:]
	return res, nil
}

func namespacedTestManifest(group string) *app.ManifestData {
	return &app.ManifestData{
		AppName:          "test",
		Group:            group,
		Versions:         []app.ManifestVersion{{Name: "v1", Served: true}},
		PreferredVersion: "v1",
	}
}

// manifestsRoute declares the _manifests route on a version.
var manifestsRoute = app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{"/" + namespacedManifestsPath: {}}}

// newTestOwner returns the owner plugin's backend, whose v3 client is client,
// serving the _manifests route at its preferred version.
func newTestOwner(t *testing.T, client appclientv3.Client) *PluginBackend {
	t.Helper()
	return newTestOwnerWithVersions(t, client, []app.ManifestVersion{
		{Name: "v0alpha1", Served: true, OpenAPI: manifestsRoute},
		{Name: "v1alpha1", Served: true, OpenAPI: manifestsRoute},
	})
}

func newTestOwnerWithVersions(t *testing.T, client appclientv3.Client, versions []app.ManifestVersion) *PluginBackend {
	t.Helper()
	manifest := &app.ManifestData{
		AppName:          "gas",
		Group:            testOwnerGroup,
		Versions:         versions,
		PreferredVersion: "v1alpha1",
	}
	clients := func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
		return nil, client, nil
	}
	owner, err := newPluginBackend("grafana-gas-app", manifest, clients, PluginDependencies{}, nil)
	require.NoError(t, err)
	owner.hasBackend = true
	return owner
}

func TestFetchNamespacedManifestsFollowsContinue(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
		"":   {Manifests: []*app.ManifestData{namespacedTestManifest("a.stacks-1.gas.ext.grafana.app")}, Continue: "p2"},
		"p2": {Manifests: []*app.ManifestData{namespacedTestManifest("b.stacks-2.gas.ext.grafana.app")}, Continue: "p3"},
		"p3": {Manifests: []*app.ManifestData{namespacedTestManifest("c.stacks-2.gas.ext.grafana.app")}},
	}}

	manifests, err := fetchNamespacedManifests(t.Context(), client, testOwnerGroup, "v1alpha1")
	require.NoError(t, err)
	var groups []string
	for _, m := range manifests {
		groups = append(groups, m.Group)
	}
	require.Equal(t, []string{"a.stacks-1.gas.ext.grafana.app", "b.stacks-2.gas.ext.grafana.app", "c.stacks-2.gas.ext.grafana.app"}, groups)

	require.Len(t, client.requests, 3)
	for i, wantContinue := range []string{"", "p2", "p3"} {
		req := client.requests[i]
		require.Equal(t, http.MethodGet, req.GetMethod())
		require.Equal(t, testOwnerGroup, req.GetGroup())
		require.Equal(t, "v1alpha1", req.GetVersion())
		require.Equal(t, "_manifests", req.GetPath())
		require.Empty(t, req.GetNamespace(), "the route is cluster-scoped")
		u, err := url.Parse(req.GetUrl())
		require.NoError(t, err)
		require.Equal(t, "/apis/gas.ext.grafana.app/v1alpha1/_manifests", u.Path)
		require.Equal(t, "100", u.Query().Get("limit"))
		require.Equal(t, wantContinue, u.Query().Get("continue"))
	}
}

func TestFetchNamespacedManifestsFailures(t *testing.T) {
	for _, tc := range []struct {
		name   string
		client *fakeManifestsClient
	}{
		{name: "status", client: &fakeManifestsClient{status: http.StatusForbidden}},
		{name: "missing page", client: &fakeManifestsClient{pages: map[string]namespacedManifestsPage{"": {Continue: "gone"}}}},
		{name: "repeated continue", client: &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
			"": {Continue: "p2"}, "p2": {Continue: "p2"},
		}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := fetchNamespacedManifests(t.Context(), tc.client, testOwnerGroup, "v1alpha1")
			require.Error(t, err)
		})
	}
}

func TestNamespacedManifestsTargetPoll(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
		"": {Manifests: []*app.ManifestData{
			namespacedTestManifest("myapp.stacks-1.gas.ext.grafana.app"),
			namespacedTestManifest("myapp.stacks-2.gas.ext.grafana.app"),
			namespacedTestManifest("gas.ext.grafana.app"),                  // the owner's own group
			namespacedTestManifest("stacks-1.gas.ext.grafana.app"),         // no name
			namespacedTestManifest("myapp.stacks_1.gas.ext.grafana.app"),   // invalid namespace
			namespacedTestManifest("myapp.stacks-1.other.ext.grafana.app"), // another owner
			{AppName: "unserved", Group: "unserved.stacks-1.gas.ext.grafana.app", Versions: []app.ManifestVersion{{Name: "v1"}}},
			nil,
		}},
	}}
	owner := newTestOwner(t, client)
	ownerKey := "managed:grafana-gas-app:abc"
	owners := []Backend{&pluginDeploymentBackend{Backend: owner, key: ownerKey, source: sourcePluginsURL}}
	target := newNamespacedManifestsTarget(testOwnerGroup, func(context.Context) []Backend { return owners })

	dirty := make(chan struct{}, 1)
	target.poll(t.Context(), dirty)
	require.Len(t, dirty, 1)

	backends := target.Backends()
	require.Len(t, backends, 2)
	namespaces := map[string]string{}
	for _, b := range backends {
		ns, ok := b.(NamespacedBackend)
		require.True(t, ok)
		namespaces[b.Group().Name] = ns.Namespace()
		require.Equal(t, "namespaced:gas.ext.grafana.app", b.Source())
		require.Regexp(t, `^namespaced:grafana-gas-app:[0-9a-f]{16}$`, b.Key())

		plugin, ok := b.(PluginStatusProvider).PluginStatus()
		require.True(t, ok)
		require.Equal(t, "grafana-gas-app", plugin.ID)
		require.True(t, plugin.HasBackend)
		manifest, ok := b.(ManifestProvider).Manifest()
		require.True(t, ok)
		require.Equal(t, b.Group().Name, manifest.Group)
	}
	require.Equal(t, map[string]string{
		"myapp.stacks-1.gas.ext.grafana.app": "stacks-1",
		"myapp.stacks-2.gas.ext.grafana.app": "stacks-2",
	}, namespaces)
	require.Equal(t, 6, target.status.status("").Skipped)

	require.Equal(t, []bool{true}, client.service, "polls as the router's service identity")
	require.Equal(t, "v1alpha1", client.requests[0].GetVersion(), "uses the owner's preferred version")
}

func TestNamespacedManifestsTargetSignalsOnlyOnKeySetChange(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
		"": {Manifests: []*app.ManifestData{namespacedTestManifest("myapp.stacks-1.gas.ext.grafana.app")}},
	}}
	owner := newTestOwner(t, client)
	ownerKey := "managed:grafana-gas-app:abc"
	target := newNamespacedManifestsTarget(testOwnerGroup, func(context.Context) []Backend {
		return []Backend{&pluginDeploymentBackend{Backend: owner, key: ownerKey}}
	})
	dirty := make(chan struct{}, 1)
	drain := func() bool {
		select {
		case <-dirty:
			return true
		default:
			return false
		}
	}

	target.poll(t.Context(), dirty)
	require.True(t, drain(), "first poll adds a group")
	first := target.Backends()[0].Key()

	target.poll(t.Context(), dirty)
	require.False(t, drain(), "an unchanged poll does not signal")

	changed := namespacedTestManifest("myapp.stacks-1.gas.ext.grafana.app")
	changed.AppDisplayName = "changed"
	client.setPages(map[string]namespacedManifestsPage{"": {Manifests: []*app.ManifestData{changed}}})
	target.poll(t.Context(), dirty)
	require.True(t, drain(), "a changed manifest changes the key")
	second := target.Backends()[0].Key()
	require.NotEqual(t, first, second)

	ownerKey = "managed:grafana-gas-app:def"
	target.poll(t.Context(), dirty)
	require.True(t, drain(), "a changed owner changes the key")
	require.NotEqual(t, second, target.Backends()[0].Key())
}

func TestNamespacedManifestsTargetWithoutOwner(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
		"": {Manifests: []*app.ManifestData{namespacedTestManifest("myapp.stacks-1.gas.ext.grafana.app")}},
	}}
	owner := newTestOwner(t, client)
	var owners []Backend
	target := newNamespacedManifestsTarget(testOwnerGroup, func(context.Context) []Backend { return owners })
	dirty := make(chan struct{}, 1)

	target.poll(t.Context(), dirty)
	require.Empty(t, target.Backends())
	require.Empty(t, dirty)
	require.Empty(t, client.requests)

	owners = []Backend{owner}
	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	require.Len(t, dirty, 1)
	<-dirty

	// An owner that goes away takes its groups with it.
	owners = nil
	target.poll(t.Context(), dirty)
	require.Empty(t, target.Backends())
	require.Len(t, dirty, 1)
}

func TestNamespacedManifestsTargetFailedPollKeepsLastKnownGood(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
		"": {Manifests: []*app.ManifestData{namespacedTestManifest("myapp.stacks-1.gas.ext.grafana.app")}},
	}}
	owner := newTestOwner(t, client)
	target := newNamespacedManifestsTarget(testOwnerGroup, func(context.Context) []Backend { return []Backend{owner} })
	dirty := make(chan struct{}, 1)

	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	<-dirty

	client.status = http.StatusInternalServerError
	target.poll(t.Context(), dirty)
	require.Len(t, target.Backends(), 1)
	require.Empty(t, dirty)
	require.Equal(t, uint64(1), target.status.status("").Failures)
}

func TestParseNamespacedGroups(t *testing.T) {
	for _, tc := range []struct {
		raw     string
		want    []string
		wantErr bool
	}{
		{raw: "", want: nil},
		{raw: "gas.ext.grafana.app", want: []string{"gas.ext.grafana.app"}},
		{raw: " a.ext.grafana.app, b.ext.grafana.app ,a.ext.grafana.app,", want: []string{"a.ext.grafana.app", "b.ext.grafana.app"}},
		{raw: "playlist.grafana.app", wantErr: true},
		{raw: ".ext.grafana.app", wantErr: true},
		{raw: "Gas.ext.grafana.app", wantErr: true},
		// The second owner is one of the first's namespaced groups.
		{raw: "gas.ext.grafana.app,a.b.gas.ext.grafana.app", wantErr: true},
	} {
		t.Run(tc.raw, func(t *testing.T) {
			cfg := cfgWithCloudRouterSection(t, map[string]string{"namespaced_groups": tc.raw})
			groups, err := parseNamespacedGroups(cfg.SectionWithEnvOverrides(cloudRouterSection))
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, groups)
		})
	}
}

func TestProvideCloudRoutesLoaderFactoryNamespacedGroups(t *testing.T) {
	t.Run("with plugins_url", func(t *testing.T) {
		cfg := cfgWithCloudRouterSection(t, map[string]string{
			"plugins_url":       "https://plugins.invalid/plugins",
			"namespaced_groups": "gas.ext.grafana.app",
		})
		loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
		require.NoError(t, err)
		loader, ok := loaderIface.(*cloudLoader)
		require.True(t, ok)
		require.Len(t, loader.namespacedTargets, 1)
		require.Equal(t, testOwnerGroup, loader.namespacedTargets[0].ownerGroup)
		require.Equal(t, []string{testOwnerGroup}, loader.pluginsTarget.namespacedOwners, "refuses the owner's namespaced groups")

		// The owner is found among the managed plugins.
		owner := newTestOwner(t, &fakeManifestsClient{})
		plugins := []Backend{&pluginDeploymentBackend{Backend: owner, key: "managed:owner"}}
		loader.pluginsTarget.snapshot.Store(&plugins)
		found, key, ok := loader.namespacedTargets[0].findOwner(t.Context())
		require.True(t, ok)
		require.Same(t, owner, found)
		require.Equal(t, "managed:owner", key)

		require.Contains(t, loader.sourceStatuses(), sourceStatus{Source: "namespaced:gas.ext.grafana.app"})
	})

	t.Run("without an owner source", func(t *testing.T) {
		cfg := cfgWithCloudRouterSection(t, map[string]string{
			"st_discovery_url":  "https://play.grafana.org/",
			"namespaced_groups": "gas.ext.grafana.app",
		})
		_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
		require.ErrorContains(t, err, "namespaced_groups")
	})

	t.Run("invalid group", func(t *testing.T) {
		cfg := cfgWithCloudRouterSection(t, map[string]string{
			"plugins_url":       "https://plugins.invalid/plugins",
			"namespaced_groups": "playlist.grafana.app",
		})
		_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
		require.ErrorContains(t, err, "namespaced_groups")
	})
}

func TestCloudLoaderNamespacedPriority(t *testing.T) {
	loader, err := newCloudLoader([]*aggregateTarget{
		priorityAggregate(priorityBackend("aggregate.stacks-1.gas.ext.grafana.app", "aggregate")),
	}, &pluginManifestsTarget{}, &pluginManifestsTarget{}, nil)
	require.NoError(t, err)
	empty := []Backend{}
	loader.coreTarget.snapshot.Store(&empty)
	plugins := []Backend{priorityBackend("plugin.stacks-1.gas.ext.grafana.app", "plugin")}
	loader.pluginsTarget.snapshot.Store(&plugins)

	target := newNamespacedManifestsTarget(testOwnerGroup, nil)
	namespaced := []Backend{
		priorityBackend("aggregate.stacks-1.gas.ext.grafana.app", "namespaced"),
		priorityBackend("plugin.stacks-1.gas.ext.grafana.app", "namespaced"),
		priorityBackend("myapp.stacks-1.gas.ext.grafana.app", "namespaced"),
	}
	target.snapshot.Store(&namespaced)
	loader.namespacedTargets = []*namespacedManifestsTarget{target}

	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	keys := map[string]string{}
	for _, b := range backends {
		keys[b.Group().Name] = b.Key()
	}
	require.Equal(t, map[string]string{
		"aggregate.stacks-1.gas.ext.grafana.app": "aggregate",
		"plugin.stacks-1.gas.ext.grafana.app":    "plugin",
		"myapp.stacks-1.gas.ext.grafana.app":     "namespaced",
	}, keys)
}

// signallingLoader returns backends and signals on notify.
type signallingLoader struct {
	backends []Backend
	notify   chan struct{}
}

func (l *signallingLoader) Load(context.Context) ([]Backend, error)         { return l.backends, nil }
func (l *signallingLoader) Notify(context.Context) (<-chan struct{}, error) { return l.notify, nil }

func TestNamespacedLoader(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{
		"": {Manifests: []*app.ManifestData{
			namespacedTestManifest("myapp.stacks-1.gas.ext.grafana.app"),
			namespacedTestManifest("local.stacks-1.gas.ext.grafana.app"),
		}},
	}}
	owner := newTestOwner(t, client)
	inner := &signallingLoader{
		backends: []Backend{owner, priorityBackend("local.stacks-1.gas.ext.grafana.app", "local")},
		notify:   make(chan struct{}),
	}
	loader := newNamespacedLoader(inner, []string{testOwnerGroup})
	target := loader.targets[0]
	dirty := make(chan struct{}, 1)

	// Before the first load, the owner is unknown.
	target.poll(t.Context(), dirty)
	require.Empty(t, target.Backends())

	// The inner loader's group in the owner's namespaced groups is refused.
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, []Backend{owner}, backends)

	target.poll(t.Context(), dirty)
	backends, err = loader.Load(t.Context())
	require.NoError(t, err)
	keys := map[string]string{}
	for _, b := range backends {
		keys[b.Group().Name] = b.Source()
	}
	require.Equal(t, map[string]string{
		testOwnerGroup:                       sourceLocalPlugin,
		"local.stacks-1.gas.ext.grafana.app": "namespaced:gas.ext.grafana.app",
		"myapp.stacks-1.gas.ext.grafana.app": "namespaced:gas.ext.grafana.app",
	}, keys)

	// Notify forwards the inner loader's signals.
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	notify, err := loader.Notify(ctx)
	require.NoError(t, err)
	select {
	case <-notify: // the poll loop may already have signalled
	default:
	}
	inner.notify <- struct{}{}
	require.Eventually(t, func() bool {
		select {
		case <-notify:
			return true
		default:
			return false
		}
	}, time.Second, time.Millisecond)
}

func TestNamespacedManifestsVersion(t *testing.T) {
	versions := func(vs ...app.ManifestVersion) *app.ManifestData { return &app.ManifestData{Versions: vs} }
	for _, tc := range []struct {
		name      string
		manifest  *app.ManifestData
		preferred string
		want      string
	}{
		{name: "nil", manifest: nil},
		{name: "no route", manifest: versions(app.ManifestVersion{Name: "v1", Served: true})},
		{name: "unserved", manifest: versions(app.ManifestVersion{Name: "v1", OpenAPI: manifestsRoute})},
		{name: "preferred", preferred: "v2", want: "v2", manifest: versions(
			app.ManifestVersion{Name: "v1", Served: true, OpenAPI: manifestsRoute},
			app.ManifestVersion{Name: "v2", Served: true, OpenAPI: manifestsRoute})},
		{name: "preferred without the route", preferred: "v2", want: "v1", manifest: versions(
			app.ManifestVersion{Name: "v1", Served: true, OpenAPI: manifestsRoute},
			app.ManifestVersion{Name: "v2", Served: true})},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := namespacedManifestsVersion(tc.manifest, tc.preferred)
			require.Equal(t, tc.want, got)
			require.Equal(t, tc.want != "", ok)
		})
	}
}

// The source polls the version that declares the route, not blindly the
// preferred one.
func TestNamespacedManifestsTargetPollsTheRoutesVersion(t *testing.T) {
	client := &fakeManifestsClient{pages: map[string]namespacedManifestsPage{"": {}}}
	owner := newTestOwnerWithVersions(t, client, []app.ManifestVersion{
		{Name: "v0alpha1", Served: true, OpenAPI: manifestsRoute},
		{Name: "v1alpha1", Served: true},
	})
	_, err := (&namespacedManifestsTarget{ownerGroup: testOwnerGroup, serviceContext: routerServiceContext}).fetch(t.Context(), owner)
	require.NoError(t, err)
	require.Equal(t, "v0alpha1", client.requests[0].GetVersion())

	owner = newTestOwnerWithVersions(t, client, []app.ManifestVersion{{Name: "v1alpha1", Served: true}})
	_, err = (&namespacedManifestsTarget{ownerGroup: testOwnerGroup, serviceContext: routerServiceContext}).fetch(t.Context(), owner)
	require.ErrorContains(t, err, "_manifests")
}

func TestNamespacedOwnerOf(t *testing.T) {
	owners := []string{"a.ext.grafana.app", testOwnerGroup}
	for group, want := range map[string]string{
		"myapp.stacks-1.gas.ext.grafana.app": testOwnerGroup,
		"x.gas.ext.grafana.app":              testOwnerGroup,
		"x.a.ext.grafana.app":                "a.ext.grafana.app",
		testOwnerGroup:                       "",
		"xgas.ext.grafana.app":               "",
		"other.ext.grafana.app":              "",
	} {
		owner, ok := namespacedOwnerOf(group, owners)
		require.Equal(t, want != "", ok, group)
		require.Equal(t, want, owner, group)
	}
}

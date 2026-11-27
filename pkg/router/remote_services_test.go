package router

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestRemoteServiceFlag(t *testing.T) {
	require.Equal(t, "aggregation.secret-grafana-app.enabled", remoteServiceFlag("secret.grafana.app"))
}

func TestReadRemoteServicesFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "svc.yaml")
	require.NoError(t, os.WriteFile(path, []byte("- group: secret.grafana.app\n  version: v1beta1\n  host: h\n  port: 6444\n"), 0o600))
	got, err := readRemoteServicesFile(path)
	require.NoError(t, err)
	require.Equal(t, []remoteService{{Group: "secret.grafana.app", Version: "v1beta1", Host: "h", Port: 6444}}, got)

	_, err = readRemoteServicesFile(filepath.Join(t.TempDir(), "missing.yaml"))
	require.Error(t, err)
}

func TestRemoteServiceTargets(t *testing.T) {
	svcs := []remoteService{
		{Group: "secret.grafana.app", Version: "v1beta1", Host: "mt", Port: 443},
		{Group: "secret.grafana.app", Version: "v1", Host: "other", Port: 1}, // first entry wins
		{Group: "folder.grafana.app", Version: "v1", Host: "mt", Port: 443},
		{Group: "off.grafana.app", Version: "v1", Host: "mt", Port: 443},
		{Group: "x.example.com", Version: "v1", Host: "x"},
		{Group: "nohost.grafana.app", Version: "v1"},
	}
	optedIn := func(_ context.Context, g string) bool { return g != "off.grafana.app" }
	o := remoteServiceOptions{audience: "aud", tokenNamespace: "stacks-1", caFile: "ca.pem", insecure: true}
	got := remoteServiceTargets(context.Background(), svcs, optedIn, o)
	require.Equal(t, []aggregateTargetConfig{
		{Name: "remote_mt:443", URL: "https://mt:443", PollInterval: defaultAggregatePollInterval, DiscoveryAuth: discoveryAuthBearer, Audience: "aud", TokenNamespace: "stacks-1",
			GroupPatterns: []string{"secret.grafana.app", "folder.grafana.app"}, CAFile: "ca.pem", InsecureSkipVerify: true},
		{Name: "remote_x", URL: "https://x", PollInterval: defaultAggregatePollInterval, DiscoveryAuth: discoveryAuthBearer, Audience: "aud", TokenNamespace: "stacks-1",
			GroupPatterns: []string{"x.example.com"}, CAFile: "ca.pem", InsecureSkipVerify: true},
	}, got)
}

func TestRemoteServiceOptedIn(t *testing.T) {
	ctx := context.Background()
	// No flag provider is set, so grafana.app groups default to off.
	require.False(t, remoteServiceOptedIn(ctx, "secret.grafana.app"))
	require.False(t, remoteServiceOptedIn(ctx, "foo.ext.grafana.app"))
	require.True(t, remoteServiceOptedIn(ctx, "features.grafana.app"))
	require.True(t, remoteServiceOptedIn(ctx, "foo.example.com"))
}

type fakeBackendLoader struct {
	backends []Backend
	err      error
}

func (f fakeBackendLoader) Load(context.Context) ([]Backend, error) { return f.backends, f.err }
func (f fakeBackendLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

func TestOverlayLoaderServesBaseUntilRemotesPoll(t *testing.T) {
	remote, err := newCloudLoader([]*aggregateTarget{{polledSource: polledSource{source: "remote"}}}, nil, nil)
	require.NoError(t, err)
	l := newOverlayLoader(fakeBackendLoader{}, remote)

	got, err := l.Load(context.Background())
	require.NoError(t, err, "a remote that has not polled must not fail the base groups")
	require.Empty(t, got)

	_, err = newOverlayLoader(fakeBackendLoader{err: errors.New("boom")}, remote).Load(context.Background())
	require.Error(t, err, "a base failure still fails the load")
}

func TestRemoteServiceOptionsCAFile(t *testing.T) {
	for _, tc := range []struct {
		name, shared, own, want string
	}{
		{name: "defaults to the shared bundle", shared: "/shared.crt", want: "/shared.crt"},
		{name: "its own bundle wins", shared: "/shared.crt", own: "/remotes.crt", want: "/remotes.crt"},
		{name: "neither", want: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			section := cfg.Raw.Section(remoteServicesSection)
			if tc.shared != "" {
				section.Key("apiservice_ca_bundle_file").SetValue(tc.shared)
			}
			if tc.own != "" {
				section.Key("remote_services_ca_file").SetValue(tc.own)
			}
			require.Equal(t, tc.want, newRemoteServiceOptions(cfg, "stacks-1").caFile)
		})
	}
}

// Remote services are for cloud ST stack pods only: the standalone router and
// a server without a stack ID refuse the file, before reading it.
func TestRemoteServicesLoaderOnlyForCloudStacks(t *testing.T) {
	file := filepath.Join(t.TempDir(), "missing.yaml")
	for _, tc := range []struct {
		name    string
		stackID string
		target  []string
		want    string
	}{
		{name: "no stack", target: []string{"all"}, want: "stack_id"},
		{name: "standalone router", stackID: "1", target: []string{"router"}, want: "standalone router"},
		{name: "a stack's pod", stackID: "1", target: []string{"all"}, want: "reading remote services file"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID, cfg.Target = tc.stackID, tc.target
			cfg.Raw.Section(remoteServicesSection).Key("remote_services_file").SetValue(file)
			_, err := newRemoteServicesLoader(t.Context(), cfg, noRoutesLoader{})
			require.ErrorContains(t, err, tc.want)
		})
	}

	base := noRoutesLoader{}
	got, err := newRemoteServicesLoader(t.Context(), setting.NewCfg(), base)
	require.NoError(t, err)
	require.Equal(t, RoutesLoader(base), got, "no file, nothing mounted")
}

package router

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/baasbridge" //nolint:staticcheck // deprecated shim, used until HTTP operators move to gRPC
	"github.com/grafana/grafana/pkg/setting"
)

const (
	devSectionPrefix = "router.dev."
	devKeyPrefix     = "dev"
)

// devManifestSettle is how long a manifest must stop changing before the
// router reloads it: an editor or generator often writes a file several times
// for one save.
var devManifestSettle = 100 * time.Millisecond

// devTargetConfig is an app served from a local manifest file by a backend
// at host: an http or https URL is reached through baasbridge, anything else
// is a gRPC address.
type devTargetConfig struct {
	Name     string
	PluginID string
	Manifest string
	Host     string
}

func parseDevTargets(cfg *setting.Cfg) ([]devTargetConfig, error) {
	if cfg == nil || cfg.Raw == nil {
		return nil, nil
	}
	var targets []devTargetConfig
	for _, raw := range cfg.Raw.Sections() {
		name, ok := strings.CutPrefix(raw.Name(), devSectionPrefix)
		if !ok {
			continue
		}
		if name == "" {
			return nil, fmt.Errorf("%s: target name is required", raw.Name())
		}
		section := cfg.SectionWithEnvOverrides(raw.Name())
		host := section.Key("host").MustString("")
		if host == "" {
			continue
		}
		manifest := section.Key("manifest").MustString("")
		if manifest == "" {
			return nil, fmt.Errorf("%s: manifest is required", raw.Name())
		}
		targets = append(targets, devTargetConfig{
			Name:     name,
			PluginID: section.Key("plugin_id").MustString(name),
			Manifest: manifest,
			Host:     host,
		})
	}
	return targets, nil
}

// devTargets serves the [router.dev.<name>] sections in the local plugin
// loader, with the managed plugins' clients and connection handling.
type devTargets struct {
	configs []devTargetConfig
	conns   *pluginConnections
	deps    PluginDependencies
}

// newDevTargets returns nil when no dev target is configured.
func newDevTargets(cfg *setting.Cfg, deps PluginDependencies) (*devTargets, error) {
	configs, err := parseDevTargets(cfg)
	if err != nil || len(configs) == 0 {
		return nil, err
	}
	grpcConfig, err := parsePluginGRPCConfig(cfg)
	if err != nil {
		return nil, err
	}
	// Like managed plugins, dev targets have no local plugin settings for the
	// legacy app-access check.
	deps.AccessControl = pluginManifestAccessControl{}
	return &devTargets{
		configs: configs,
		conns:   newPluginConnections(sourceDev, grpcConfig, deps.MetricsRegister),
		deps:    deps,
	}, nil
}

func readDevManifest(path string) (*app.ManifestData, error) {
	// The path comes from the operator's own config.
	f, err := os.Open(path) //nolint:gosec
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	raw, err := io.ReadAll(io.LimitReader(f, maxPluginManifestsBytes+1))
	if err != nil {
		return nil, err
	}
	if len(raw) > maxPluginManifestsBytes {
		return nil, fmt.Errorf("manifest is larger than %d bytes", maxPluginManifestsBytes)
	}
	manifest, err := definition.ParseManifest(raw)
	if err != nil {
		return nil, err
	}
	definition.MigrateDeprecatedRoutes(manifest)
	return manifest, nil
}

// declareRoles registers each target's manifest roles, as initLocalPlugin
// does for local plugins. Roles are declared once, at startup, so a change to
// a manifest's roles needs a restart. A target whose roles fail is only
// logged, so one bad manifest can't stop Grafana from starting.
func (d *devTargets) declareRoles(ctx context.Context, service accesscontrol.Service) {
	if d == nil {
		return
	}
	for _, c := range d.configs {
		manifest, err := readDevManifest(c.Manifest)
		if err == nil {
			err = declareLocalManifestRoles(ctx, service, c.PluginID, c.Name, manifest)
		}
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping roles for dev target", "target", c.Name, "manifest", c.Manifest, "err", err)
		}
	}
}

// backends reads every manifest on each load. A target that fails is skipped,
// so it never keeps the others from loading.
func (d *devTargets) backends(ctx context.Context) []Backend {
	if d == nil {
		return nil
	}
	backends := make([]Backend, 0, len(d.configs))
	for _, c := range d.configs {
		backend, err := d.backend(c)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping dev target", "target", c.Name, "manifest", c.Manifest, "err", err)
			continue
		}
		backends = append(backends, backend)
	}
	return backends
}

func (d *devTargets) backend(c devTargetConfig) (Backend, error) {
	manifest, err := readDevManifest(c.Manifest)
	if err != nil {
		return nil, err
	}
	clients := func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error) {
		return d.conns.pluginClients(c.Host, c.PluginID, manifest)
	}
	backend, err := newPluginBackend(c.PluginID, manifest, clients, d.deps, nil)
	if err != nil {
		return nil, err
	}
	backend.hasBackend = true
	if !baasbridge.IsHTTPHost(c.Host) { //nolint:staticcheck
		backend.acquire = func() (func(), error) { return d.conns.acquireConnection(c.Host, c.PluginID) }
	}
	entry := definition.PluginDeployment{Host: c.Host}
	entry.Definition.JSONData.ID = c.PluginID
	key, err := pluginDeploymentKey(devKeyPrefix, entry, manifest)
	if err != nil {
		return nil, err
	}
	backend.key, backend.source = key, sourceDev
	return backend, nil
}

// notify wakes the router when a manifest file changes. A changed manifest
// changes its backend's key, so the reload rebuilds only that target's group.
// Each manifest's directory is watched rather than the file, since editors and
// generators often replace a file by renaming another over it, which ends a
// watch on the file itself.
func (d *devTargets) notify(ctx context.Context) (<-chan struct{}, error) {
	dirty := make(chan struct{}, 1)
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("router: watching dev manifests: %w", err)
	}
	manifests := make(map[string]struct{}, len(d.configs))
	for _, c := range d.configs {
		path, err := filepath.Abs(c.Manifest)
		if err != nil {
			logging.FromContext(ctx).Warn("router: not watching dev manifest", "target", c.Name, "manifest", c.Manifest, "err", err)
			continue
		}
		if err := watcher.Add(filepath.Dir(path)); err != nil {
			logging.FromContext(ctx).Warn("router: not watching dev manifest", "target", c.Name, "manifest", c.Manifest, "err", err)
			continue
		}
		manifests[path] = struct{}{}
	}

	go func() {
		defer func() { _ = watcher.Close() }()
		settle := time.NewTimer(0)
		settle.Stop()
		defer settle.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-settle.C:
				logging.FromContext(ctx).Info("router: dev manifest changed, reloading")
				wake(dirty)
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				logging.FromContext(ctx).Warn("router: watching dev manifests", "err", err)
			case e, ok := <-watcher.Events:
				if !ok {
					return
				}
				// A change of mode or access time leaves the content as it was.
				if e.Op == fsnotify.Chmod {
					continue
				}
				if _, watched := manifests[filepath.Clean(e.Name)]; watched {
					settle.Reset(devManifestSettle)
				}
			}
		}
	}()
	return dirty, nil
}

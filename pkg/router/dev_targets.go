package router

import (
	"context"
	"fmt"
	"os"
	"strings"

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
	conns   *pluginManifestsTarget
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
		conns: &pluginManifestsTarget{
			keyPrefix:       devKeyPrefix,
			source:          sourceDev,
			deps:            deps,
			grpcConfig:      grpcConfig,
			httpTransport:   baasbridge.NewTransport(grpcConfig.TLS, backendResponseHeaderTimeout), //nolint:staticcheck
			requestDuration: newPluginGRPCRequestDuration(deps.MetricsRegister, sourceDev),
			requestRetries:  newPluginGRPCRequestRetries(deps.MetricsRegister, sourceDev),
		},
	}, nil
}

func readDevManifest(path string) (*app.ManifestData, error) {
	// The path comes from the operator's own config.
	raw, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		return nil, err
	}
	manifest, err := definition.ParseManifest(raw)
	if err != nil {
		return nil, err
	}
	definition.MigrateDeprecatedRoutes(manifest)
	return manifest, nil
}

// declareRoles registers each target's manifest roles, as initLocalPlugins
// does for local plugins.
func (d *devTargets) declareRoles(ctx context.Context, service accesscontrol.Service) error {
	if d == nil {
		return nil
	}
	for _, c := range d.configs {
		manifest, err := readDevManifest(c.Manifest)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping roles for dev target", "target", c.Name, "manifest", c.Manifest, "err", err)
			continue
		}
		if !isPluginManifestGroup(manifest.Group) {
			continue
		}
		if err := declareManifestRoles(service, manifest.Group, c.Name, manifest); err != nil {
			return fmt.Errorf("error declaring roles for dev target %s: %w", c.Name, err)
		}
	}
	return nil
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
	backend, err := newPluginBackend(c.PluginID, manifest, clients, d.conns.deps, nil)
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
	return &pluginDeploymentBackend{Backend: backend, key: key, source: sourceDev}, nil
}

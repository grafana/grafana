package router

import (
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/baasbridge" //nolint:staticcheck // deprecated shim, used until HTTP operators move to gRPC
	"github.com/grafana/grafana/pkg/setting"
)

const externalKeyPrefix = "external"

// externalManifests serves an ExternalManifestSource, with the managed
// plugins' clients and connection handling, as devTargets does. The source is
// read on every load, so a change is served on the next reconcile.
type externalManifests struct {
	source ExternalManifestSource
	conns  *pluginManifestsTarget
	status pollStatus

	// last is what the last successful read built, served while the source
	// fails.
	last atomic.Pointer[[]Backend]
}

// newExternalManifests returns nil when deps has no external manifest source.
func newExternalManifests(cfg *setting.Cfg, deps PluginDependencies) (*externalManifests, error) {
	if deps.ExternalManifests == nil {
		return nil, nil
	}
	grpcConfig, err := parsePluginGRPCConfig(cfg)
	if err != nil {
		return nil, err
	}
	// Like managed plugins, external manifests have no local plugin settings
	// for the legacy app-access check.
	deps.AccessControl = pluginManifestAccessControl{}
	e := &externalManifests{
		source: deps.ExternalManifests,
		conns: &pluginManifestsTarget{
			keyPrefix:       externalKeyPrefix,
			source:          sourceExternal,
			deps:            deps,
			grpcConfig:      grpcConfig,
			httpTransport:   baasbridge.NewTransport(grpcConfig.TLS, backendResponseHeaderTimeout), //nolint:staticcheck
			requestDuration: newPluginGRPCRequestDuration(deps.MetricsRegister, sourceExternal),
			requestRetries:  newPluginGRPCRequestRetries(deps.MetricsRegister, sourceExternal),
		},
	}
	empty := []Backend{}
	e.last.Store(&empty)
	return e, nil
}

// backends reads the source and builds a backend for each manifest. A
// manifest that fails is skipped, so it never keeps the others from loading.
// When the read itself fails, the last set read keeps serving.
func (e *externalManifests) backends(ctx context.Context) []Backend {
	if e == nil {
		return nil
	}
	entries, err := e.source.Manifests(ctx)
	if err != nil {
		e.status.recordFailure()
		logging.FromContext(ctx).Warn("router: reading external manifests failed, serving the last set read", "err", err)
		return *e.last.Load()
	}
	backends := make([]Backend, 0, len(entries))
	skipped := 0
	for _, entry := range entries {
		backend, err := e.backend(entry)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping external manifest", "name", entry.Name, "err", err)
			skipped++
			continue
		}
		backends = append(backends, backend)
	}
	e.last.Store(&backends)
	e.status.recordSkipped(skipped)
	e.status.recordSuccess(time.Now())
	return backends
}

func (e *externalManifests) backend(entry ExternalManifest) (Backend, error) {
	if errs := validation.IsDNS1123Subdomain(entry.Name); len(errs) > 0 {
		return nil, fmt.Errorf("invalid name %q: %s", entry.Name, strings.Join(errs, "; "))
	}
	if entry.Manifest == nil {
		return nil, errors.New("missing manifest")
	}
	manifest := withDefaultPlurals(entry.Manifest)

	// A connection records its calls under one plugin_id. With no plugin, the
	// group labels it, as it does for a core_url entry without a plugin ID.
	connectionID := manifest.Group
	clients := func(ctx context.Context, _ string) (plugins.Client, appclientv3.Client, error) {
		return e.conns.pluginClients(entry.Host, connectionID, manifest)
	}
	backend, err := newPluginBackend("", manifest, clients, e.conns.deps, nil)
	if err != nil {
		return nil, err
	}
	backend.hasBackend = entry.Host != ""
	if host := entry.Host; host != "" && !baasbridge.IsHTTPHost(host) { //nolint:staticcheck
		backend.acquire = func() (func(), error) { return e.conns.acquireConnection(host, connectionID) }
	}
	key, err := externalManifestKey(entry.Name, manifest, entry.Host)
	if err != nil {
		return nil, err
	}
	return &pluginDeploymentBackend{Backend: backend, key: key, source: sourceExternal}, nil
}

func externalManifestKey(name string, manifest *app.ManifestData, host string) (string, error) {
	body, err := json.Marshal(struct {
		Manifest *app.ManifestData
		Host     string
	}{manifest, host})
	if err != nil {
		return "", fmt.Errorf("router: fingerprinting external manifest %q: %w", name, err)
	}
	sum := sha256.Sum256(body)
	return externalKeyPrefix + ":" + name + ":" + hex.EncodeToString(sum[:])[:16], nil
}

// withDefaultPlurals returns a copy of manifest in which every kind without a
// plural has the one apiextensions stores it under, lowercase kind + "s", so
// the router reads and writes the same objects. The manifest loader does this
// for plugins, but a source may build its manifests in code.
func withDefaultPlurals(manifest *app.ManifestData) *app.ManifestData {
	out := *manifest
	out.Versions = slices.Clone(manifest.Versions)
	for i := range out.Versions {
		kinds := slices.Clone(out.Versions[i].Kinds)
		for j := range kinds {
			if kinds[j].Plural == "" {
				kinds[j].Plural = strings.ToLower(kinds[j].Kind) + "s"
			}
		}
		out.Versions[i].Kinds = kinds
	}
	return &out
}

// declareRoles registers each manifest's roles, as initLocalPlugins does for
// local plugins, except for groups a local plugin serves: the plugin wins the
// group, and its roles with it. Roles are declared once, at startup, so a
// manifest whose roles change needs a restart. A manifest whose roles fail is
// only logged, so one bad manifest can't stop Grafana from starting.
func (e *externalManifests) declareRoles(ctx context.Context, service accesscontrol.Service, pluginGroups map[string]struct{}) {
	if e == nil {
		return
	}
	entries, err := e.source.Manifests(ctx)
	if err != nil {
		logging.FromContext(ctx).Warn("router: reading external manifests for their roles failed", "err", err)
		return
	}
	for _, entry := range entries {
		if entry.Manifest == nil {
			continue
		}
		if _, ok := pluginGroups[entry.Manifest.Group]; ok {
			continue
		}
		name := cmp.Or(entry.Manifest.AppDisplayName, entry.Manifest.AppName, entry.Name)
		if err := declareLocalManifestRoles(ctx, service, entry.Name, name, withDefaultPlurals(entry.Manifest)); err != nil {
			logging.FromContext(ctx).Warn("router: skipping external manifest roles", "name", entry.Name, "err", err)
		}
	}
}

// forward wakes dirty whenever the source notifies, until ctx is done or the
// source closes its channel.
func (e *externalManifests) forward(ctx context.Context, dirty chan<- struct{}) {
	if e == nil {
		return
	}
	changed := e.source.Notify()
	if changed == nil {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case _, ok := <-changed:
			if !ok {
				return
			}
			wake(dirty)
		}
	}
}

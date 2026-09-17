package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"sync/atomic"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

// pluginManifestsTarget polls a plugin-manifests operator's GET /plugins on
// a cooldown -- same pacing/dirty-signal shape as aggregateTarget (see
// aggregate_poller.go), reused here for consistency rather than inventing a
// second pacing scheme. The wire format and backend shape are unrelated to
// aggregateTarget's, though: definition.PluginDeployments rather than a k8s
// discovery document, and no reverse-proxy target to build (see
// pluginManifestDummyBackend), so this does not share
// discoverGroups/newAggregateBackend.
type pluginManifestsTarget struct {
	url      string
	client   *http.Client
	patterns []*regexp.Regexp
	deps     PluginDependencies

	cooldown *cooldown

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]
}

func newPluginManifestsTarget(rawURL string, patterns []*regexp.Regexp, client *http.Client, deps PluginDependencies) (*pluginManifestsTarget, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("router: parsing plugins_url %q: %w", rawURL, err)
	}
	// Same rationale as newAggregateTarget's check: url.Parse alone accepts
	// empty/relative values without error, which would otherwise build a
	// target that polls a URL it can never reach and only ever surfaces as a
	// recurring background WARN.
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("router: plugins_url must be absolute (scheme and host required): url=%q", rawURL)
	}

	t := &pluginManifestsTarget{
		deps:     deps,
		url:      rawURL,
		client:   client,
		patterns: patterns,
		cooldown: newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	empty := []Backend{}
	t.snapshot.Store(&empty)
	emptyKeys := map[string]struct{}{}
	t.lastKeys.Store(&emptyKeys)
	return t, nil
}

// Backends returns the current polled-and-filtered backend snapshot. Safe
// to call from any goroutine.
func (t *pluginManifestsTarget) Backends() []Backend {
	return *t.snapshot.Load()
}

// run polls until ctx is done, paced entirely by t.cooldown -- identical
// shape to aggregateTarget.run; see that method's doc for why there is
// deliberately only one timing source.
func (t *pluginManifestsTarget) run(ctx context.Context, dirty chan<- struct{}) {
	timer := time.NewTimer(0) // fire immediately; don't wait an interval for the first attempt
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			t.poll(ctx, dirty)
			timer.Reset(t.cooldown.Until(time.Now()))
		}
	}
}

// poll performs one fetch-and-decode attempt and records its outcome on the
// cooldown, which schedules the next attempt. No pacing check of its own --
// run()'s timer is the only gate.
func (t *pluginManifestsTarget) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()

	deployment, err := fetchPluginManifests(ctx, t.client, t.url)
	if err != nil {
		t.cooldown.OnFailure(now)
		slog.Warn("router: plugin manifests poll failed, backing off", "url", t.url, "err", err)
		return
	}
	t.cooldown.OnSuccess(now)

	backends := make([]Backend, 0, len(deployment.Plugins))
	keys := make(map[string]struct{}, len(deployment.Plugins))
	for _, entry := range deployment.Plugins {
		if entry.Definition.Manifest == nil {
			continue
		}
		group := apiGroupFromManifestData(*entry.Definition.Manifest)
		if !matchesAnyPattern(group.Name, t.patterns) {
			continue
		}

		var backend Backend
		if t.deps.Unified != nil && t.deps.SecureValues != nil {
			backend, err = NewPluginBackend(entry.Definition,
				func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error) {
					// TODO!!! get grpc client to
					slog.Info("TODO get plugin client from host", "pluginId", entry.Definition.JSONData.ID, "url", entry.Host)
					return nil, nil, nil
				}, t.deps,
			)
		} else {
			backend, err = newPluginManifestDummyBackend(entry, group)
		}

		if err != nil {
			slog.Warn("router: skipping plugin entry", "pluginId", entry.Definition.JSONData.ID, "err", err)
			continue
		}
		backends = append(backends, backend)
		keys[backend.Key()] = struct{}{}
	}

	t.snapshot.Store(&backends)

	lastKeys := *t.lastKeys.Load()
	if !sameKeySet(lastKeys, keys) {
		t.lastKeys.Store(&keys)
		select {
		case dirty <- struct{}{}:
		default: // already pending; coalesce
		}
	}
}

// fetchPluginManifests fetches and decodes the plugin-manifests operator's
// GET /plugins response into definition.PluginDeployments -- the
// {"key","plugins":[{"definition":{"jsonData","manifest"},"host"}]} envelope
// that type describes, confirmed against a live operator instance. Unlike
// the k8s-style APIGroupList discoverGroups fetches for the aggregate
// targets, this is a bespoke, cloud-router-specific format.
func fetchPluginManifests(ctx context.Context, client *http.Client, rawURL string) (*definition.PluginDeployments, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, fmt.Errorf("router: building plugin manifests request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("router: plugin manifests request to %s failed: %w", rawURL, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("router: plugin manifests request to %s returned status %d", rawURL, resp.StatusCode)
	}

	deployment := &definition.PluginDeployments{}
	if err := json.NewDecoder(resp.Body).Decode(deployment); err != nil {
		return nil, fmt.Errorf("router: decoding plugin manifests from %s: %w", rawURL, err)
	}
	return deployment, nil
}

// pluginManifestDummyBackend is a dummy backend used when the full dependencies are not provided
type pluginManifestDummyBackend struct {
	group metav1.APIGroup
	key   string
	entry definition.PluginDeployment
}

var _ Backend = &pluginManifestDummyBackend{}

func newPluginManifestDummyBackend(entry definition.PluginDeployment, group metav1.APIGroup) (Backend, error) {
	body, err := json.Marshal(entry)
	if err != nil {
		return nil, fmt.Errorf("router: fingerprinting plugin manifest entry %q: %w", entry.Definition.JSONData.ID, err)
	}
	sum := sha256.Sum256(body)
	key := "plugins_url:" + entry.Definition.JSONData.ID + ":" + hex.EncodeToString(sum[:])[:16]

	return &pluginManifestDummyBackend{
		group: group,
		key:   key,
		entry: entry,
	}, nil
}

func (b *pluginManifestDummyBackend) Group() metav1.APIGroup { return b.group }
func (b *pluginManifestDummyBackend) Key() string            { return b.key }

func (b *pluginManifestDummyBackend) Load(context.Context) (http.Handler, error) {
	return b, nil
}

func (b *pluginManifestDummyBackend) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(b.entry)
}

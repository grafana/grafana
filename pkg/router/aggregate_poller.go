package router

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// Defaults for background discovery polling.
const (
	// defaultAggregatePollInterval is the cooldown's interval while healthy.
	defaultAggregatePollInterval = 30 * time.Second
	defaultAggregateMinBackoff   = 5 * time.Second
	defaultAggregateMaxBackoff   = 5 * time.Minute

	// defaultAggregateDiscoveryTimeout bounds each discovery request, since a
	// hung request would otherwise stall that target's poll loop forever.
	defaultAggregateDiscoveryTimeout = 10 * time.Second
)

// aggregateTarget polls one configured upstream apiserver's discovery.
type aggregateTarget struct {
	polledSource

	name     string
	base     *url.URL
	client   *http.Client
	patterns []*regexp.Regexp

	// proxyTransport carries caller traffic with the caller's own credentials.
	// client is separate: it signs the router's own discovery polls.
	proxyTransport http.RoundTripper
}

func newAggregateTarget(cfg aggregateTargetConfig, client *http.Client, proxyTransport http.RoundTripper) (*aggregateTarget, error) {
	base, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("router: parsing %s url %q: %w", cfg.Name, cfg.URL, err)
	}
	// url.Parse accepts empty and relative URLs; fail startup instead of
	// polling a URL that can never work.
	if base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("router: %s url must be absolute (scheme and host required): url=%q", cfg.Name, cfg.URL)
	}
	// A trailing slash would turn "/apis" into "//apis".
	base.Path = strings.TrimRight(base.Path, "/")

	interval := cfg.PollInterval
	if interval == 0 {
		interval = defaultAggregatePollInterval
	}
	t := &aggregateTarget{
		name:           cfg.Name,
		base:           base,
		client:         client,
		proxyTransport: proxyTransport,
		patterns:       compileGroupPatterns(cfg.GroupPatterns),
	}
	t.polledSource = polledSource{
		source:   aggregateSource(cfg.Name),
		fetcher:  t,
		cooldown: newCooldown(interval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	return t, nil
}

// fetch implements [sourceFetcher]: one discovery request, filtered by the
// target's group patterns.
func (t *aggregateTarget) fetch(ctx context.Context) ([]Backend, int, error) {
	groups, err := discoverGroupResources(ctx, t.client, t.base.String())
	if err != nil {
		return nil, 0, err
	}

	backends := make([]Backend, 0, len(groups))
	skipped := 0
	for _, discovered := range groups {
		if !matchesAnyPattern(discovered.group.Name, t.patterns) {
			continue
		}
		backend, err := newDiscoveredAggregateBackend(t.name, discovered, t.base, t.proxyTransport)
		if err != nil {
			logging.FromContext(ctx).Warn("router: skipping unfingerprintable discovered group", "target", t.name, "group", discovered.group.Name, "err", err)
			skipped++
			continue
		}
		backends = append(backends, backend)
	}
	return backends, skipped, nil
}

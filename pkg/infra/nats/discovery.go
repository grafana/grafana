package nats

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	// discoveryClusterName scopes peer rows so independent Grafana clusters can
	// share one DB without cross-wiring meshes; matches Cluster.Name.
	discoveryClusterName = "grafana"

	// Fallbacks used when the config supplies no interval/TTL. Keep the TTL a
	// comfortable multiple of the interval so one missed tick doesn't evict a peer.
	defaultDiscoveryInterval = 5 * time.Second
	defaultDiscoveryTTL      = 30 * time.Second
)

// peer is an embedded NATS server advertising the cluster route URL peers dial.
type peer struct {
	ServerName string
	RouteURL   string
}

// peerRegistry is the persistence seam for cluster membership (topology metadata
// only, never event state). Production is KV-backed; tests supply a fake.
type peerRegistry interface {
	// upsert records or refreshes this node's row (a heartbeat).
	upsert(ctx context.Context, p peer) error
	// activePeers returns every peer whose heartbeat is within ttl.
	activePeers(ctx context.Context, ttl time.Duration) ([]peer, error)
	// pruneStale deletes rows older than ttl; self-healing via re-registration.
	pruneStale(ctx context.Context, ttl time.Duration) error
	// remove deletes this node's row on graceful shutdown.
	remove(ctx context.Context, serverName string) error
}

// discovery peers embedded NATS replicas through a KV-backed registry: each node
// advertises its route URL and periodically solicits routes to live peers, so a
// multi-replica deployment self-assembles into a mesh without static config.
type discovery struct {
	log      log.Logger
	server   *natsserver.Server
	baseOpts natsserver.Options
	registry peerRegistry
	self     peer
	interval time.Duration
	ttl      time.Duration

	// routes is the applied peer route set; only touched by the loop goroutine.
	routes map[string]struct{}
}

// discoveryOptions bundles the embedded server's base options with the
// discovery loop cadence. baseOpts is the template applyRoutes reloads routes
// from; interval/ttl fall back to package defaults when non-positive.
type discoveryOptions struct {
	baseOpts natsserver.Options
	interval time.Duration
	ttl      time.Duration
}

func newDiscovery(logger log.Logger, server *natsserver.Server, registry peerRegistry, self peer, opts discoveryOptions) *discovery {
	interval := opts.interval
	if interval <= 0 {
		interval = defaultDiscoveryInterval
	}
	ttl := opts.ttl
	if ttl <= 0 {
		ttl = defaultDiscoveryTTL
	}
	return &discovery{
		log:      logger,
		server:   server,
		baseOpts: opts.baseOpts,
		registry: registry,
		self:     self,
		interval: interval,
		ttl:      ttl,
		routes:   map[string]struct{}{},
	}
}

// run drives the discovery loop until ctx is cancelled. It always returns nil so
// a failing registry only degrades clustering rather than tearing down the server.
func (d *discovery) run(ctx context.Context) error {
	// Register and reconcile immediately so we don't wait a full interval.
	d.tick(ctx)

	ticker := time.NewTicker(d.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			d.tick(ctx)
		}
	}
}

func (d *discovery) tick(ctx context.Context) {
	if err := d.registry.upsert(ctx, d.self); err != nil {
		d.log.Warn("nats peer heartbeat failed", "server_name", d.self.ServerName, "err", err)
	}
	if err := d.registry.pruneStale(ctx, d.ttl); err != nil {
		d.log.Warn("nats peer prune failed", "err", err)
	}
	d.reconcile(ctx)
}

// reconcile reloads the server's routes when the live-peer set has changed; NATS
// solicits new routes and closes removed ones.
func (d *discovery) reconcile(ctx context.Context) {
	peers, err := d.registry.activePeers(ctx, d.ttl)
	if err != nil {
		d.log.Warn("failed to list nats peers", "err", err)
		return
	}

	desired := make(map[string]struct{}, len(peers))
	for _, p := range peers {
		// Skip our own row and peers that haven't advertised a route yet.
		if p.ServerName == d.self.ServerName || p.RouteURL == "" {
			continue
		}
		desired[p.RouteURL] = struct{}{}
	}

	if sameRouteSet(d.routes, desired) {
		return
	}

	if err := d.applyRoutes(desired); err != nil {
		d.log.Error("failed to apply nats cluster routes", "err", err)
		return
	}
	d.routes = desired
	d.log.Info("reconciled nats cluster routes", "peers", len(desired))
}

func (d *discovery) applyRoutes(routes map[string]struct{}) error {
	urls := make([]*url.URL, 0, len(routes))
	for r := range routes {
		u, err := url.Parse(r)
		if err != nil {
			// A bad URL still counts as "applied" (see caller), so we log once and
			// don't retry it every tick until the peer re-advertises a valid one.
			d.log.Warn("skipping invalid peer route url", "url", r, "err", err)
			continue
		}
		urls = append(urls, u)
	}

	// Reload from a copy: ReloadOptions mutates what it's given, so we keep baseOpts
	// stable and rebuild Routes from scratch each time.
	opts := d.baseOpts
	opts.Routes = urls
	return d.server.ReloadOptions(&opts)
}

// deregister removes this node's row so peers stop dialing it immediately instead
// of waiting for the TTL. Best-effort: the TTL prune is the backstop.
func (d *discovery) deregister(ctx context.Context) {
	if err := d.registry.remove(ctx, d.self.ServerName); err != nil {
		d.log.Warn("failed to deregister nats peer", "server_name", d.self.ServerName, "err", err)
	}
}

func sameRouteSet(a, b map[string]struct{}) bool {
	if len(a) != len(b) {
		return false
	}
	for k := range a {
		if _, ok := b[k]; !ok {
			return false
		}
	}
	return true
}

// peerRecord is the JSON value stored per peer under kv.NATSPeersSection.
// updatedAt is epoch seconds; the store filters on it in memory since the KV
// section is a plain key/value table with no queryable timestamp column.
type peerRecord struct {
	ServerName string `json:"serverName"`
	RouteURL   string `json:"routeURL"`
	UpdatedAt  int64  `json:"updatedAt"`
}

// kvPeerStore is the KV-backed peerRegistry. Keys are "<clusterName>/<serverName>"
// so peers of independent clusters sharing one KV never cross-wire, and a cluster's
// rows form a contiguous prefix range for listing.
type kvPeerStore struct {
	kv          kv.KV
	clusterName string
	now         func() time.Time
}

func newKVPeerStore(store kv.KV, clusterName string) *kvPeerStore {
	return &kvPeerStore{kv: store, clusterName: clusterName, now: time.Now}
}

func (s *kvPeerStore) peerKey(serverName string) string {
	return s.clusterName + "/" + serverName
}

func (s *kvPeerStore) upsert(ctx context.Context, p peer) error {
	data, err := json.Marshal(peerRecord{
		ServerName: p.ServerName,
		RouteURL:   p.RouteURL,
		UpdatedAt:  s.now().Unix(),
	})
	if err != nil {
		return err
	}
	w, err := s.kv.Save(ctx, kv.NATSPeersSection, s.peerKey(p.ServerName))
	if err != nil {
		return err
	}
	if _, err := w.Write(data); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

func (s *kvPeerStore) activePeers(ctx context.Context, ttl time.Duration) ([]peer, error) {
	cutoff := s.now().Add(-ttl).Unix()
	var peers []peer
	for rec, err := range s.records(ctx) {
		if err != nil {
			return nil, err
		}
		if rec.UpdatedAt < cutoff {
			continue
		}
		peers = append(peers, peer{ServerName: rec.ServerName, RouteURL: rec.RouteURL})
	}
	return peers, nil
}

func (s *kvPeerStore) pruneStale(ctx context.Context, ttl time.Duration) error {
	cutoff := s.now().Add(-ttl).Unix()
	var stale []string
	for rec, err := range s.records(ctx) {
		if err != nil {
			return err
		}
		if rec.UpdatedAt < cutoff {
			stale = append(stale, s.peerKey(rec.ServerName))
		}
	}
	for _, key := range stale {
		if err := s.kv.Delete(ctx, kv.NATSPeersSection, key); err != nil {
			return err
		}
	}
	return nil
}

func (s *kvPeerStore) remove(ctx context.Context, serverName string) error {
	return s.kv.Delete(ctx, kv.NATSPeersSection, s.peerKey(serverName))
}

// records iterates this cluster's peer records. A row that vanishes mid-scan
// (a concurrent prune/remove) is skipped rather than failing the whole read.
func (s *kvPeerStore) records(ctx context.Context) func(func(peerRecord, error) bool) {
	prefix := s.clusterName + "/"
	return func(yield func(peerRecord, error) bool) {
		for key, err := range s.kv.Keys(ctx, kv.NATSPeersSection, kv.ListOptions{
			StartKey: prefix,
			EndKey:   kv.PrefixRangeEnd(prefix),
		}) {
			if err != nil {
				yield(peerRecord{}, err)
				return
			}
			rec, err := s.readPeer(ctx, key)
			if err != nil {
				if errors.Is(err, kv.ErrNotFound) {
					continue
				}
				yield(peerRecord{}, err)
				return
			}
			if !yield(rec, nil) {
				return
			}
		}
	}
}

func (s *kvPeerStore) readPeer(ctx context.Context, key string) (peerRecord, error) {
	r, err := s.kv.Get(ctx, kv.NATSPeersSection, key)
	if err != nil {
		return peerRecord{}, err
	}
	defer func() { _ = r.Close() }()

	data, err := io.ReadAll(r)
	if err != nil {
		return peerRecord{}, err
	}

	var rec peerRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return peerRecord{}, fmt.Errorf("decode nats peer %q: %w", key, err)
	}
	return rec, nil
}

package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/url"
	"slices"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	// keeps each prune under the KV BatchDelete limit (200 keys).
	maxPeerDeleteBatch = 199

	// discoveryClusterName scopes peer rows so independent Grafana clusters can
	// share one DB without cross-wiring meshes; matches Cluster.Name.
	discoveryClusterName = "grafana"

	// Fallbacks used when the config supplies no interval/TTL. Keep the TTL a
	// comfortable multiple of the interval so one missed tick doesn't evict a peer.
	defaultDiscoveryInterval = 5 * time.Second
	defaultDiscoveryTTL      = 15 * time.Second

	// A silent peer's row is deleted this many TTLs after its last change,
	// well after its route is dropped.
	pruneAfterTTLs = 4

	// A leaving peer publishes here after deregistering so the others drop its
	// route now rather than on their next tick.
	discoveryWakeSubject = "grafana.internal.discovery.wake"
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
	// list returns every row of this cluster, live or not. Liveness is the
	// caller's call, see discovery.observe.
	list(ctx context.Context) ([]peerRecord, error)
	// prune deletes the rows of the given peers.
	prune(ctx context.Context, serverNames []string) error
	// remove deletes this node's row on graceful shutdown.
	remove(ctx context.Context, serverName string) error
}

// discovery peers embedded NATS replicas through a KV-backed registry: each node
// advertises its route URL and periodically solicits routes to live peers, so a
// multi-replica deployment self-assembles into a mesh without static config.
type discovery struct {
	log      log.Logger
	server   *natsserver.Server
	reload   func(routes []*url.URL) error
	registry peerRegistry
	self     peer
	interval time.Duration
	ttl      time.Duration
	metrics  *serverMetrics

	wake     chan struct{}
	wakeConn *natsclient.Conn

	// now is the observer clock. It must be time.Now outside tests: liveness
	// relies on its monotonic reading to ignore wall-clock steps.
	now func() time.Time

	// The fields below are only touched by the loop goroutine.

	// routes is the applied peer route set.
	routes map[string]struct{}
	// observed tracks when each peer's row last changed, by server name.
	observed map[string]observation
	// failedAt is the last tick whose heartbeat or read failed.
	failedAt time.Time
}

// observation is what an observer last saw of a peer's row. Peers are judged
// by whether their row changes, timed on the observer's own clock. updatedAt
// is only compared for equality, so the writer's clock may be skewed, but it
// must advance at least a second between heartbeats.
type observation struct {
	updatedAt int64
	changedAt time.Time
	excluded  bool
}

// discoveryOptions bundles how routes reach the embedded server with the
// discovery loop cadence. reload replaces the server's solicited routes;
// interval/ttl fall back to package defaults when non-positive.
type discoveryOptions struct {
	reload   func(routes []*url.URL) error
	interval time.Duration
	ttl      time.Duration
	metrics  *serverMetrics
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
	if minTTL := minDiscoveryTTL(interval); ttl < minTTL {
		logger.Warn("nats discovery_ttl too short for discovery_interval, raising it", "configured", ttl, "interval", interval, "ttl", minTTL)
		ttl = minTTL
	}
	d := &discovery{
		log:      logger,
		server:   server,
		reload:   opts.reload,
		registry: registry,
		self:     self,
		interval: interval,
		ttl:      ttl,
		metrics:  opts.metrics,
		now:      time.Now,
		routes:   map[string]struct{}{},
		observed: map[string]observation{},
		wake:     make(chan struct{}, 1),
	}
	d.connectWake()
	return d
}

// minDiscoveryTTL is the shortest TTL that keeps heartbeating peers routed.
// UpdatedAt has one-second resolution, so a row changes at most once a second,
// up to an interval after the second turns, and an observer may see it one
// interval late.
func minDiscoveryTTL(interval time.Duration) time.Duration {
	return time.Second + 2*interval
}

func (d *discovery) connectWake() {
	nc, err := natsclient.Connect(d.server.ClientURL(),
		natsclient.InProcessServer(d.server),
		natsclient.Name("grafana-nats-discovery-wake"),
		natsclient.NoEcho(),
		// An in-process connection only drops when the server shuts down, so
		// reconnecting would retry a server that is gone.
		natsclient.NoReconnect(),
	)
	if err != nil {
		d.log.Warn("nats discovery wake unavailable; relying on periodic ticks only", "err", err)
		return
	}
	if _, err := nc.Subscribe(discoveryWakeSubject, func(*natsclient.Msg) {
		d.metrics.recordDiscoveryWake()
		select {
		case d.wake <- struct{}{}:
		default:
		}
	}); err != nil {
		d.log.Warn("nats discovery wake subscribe failed; relying on periodic ticks only", "err", err)
		nc.Close()
		return
	}
	// The server only knows of the subscription, and tells routed peers, once
	// it has processed it; until then a peer's wake would not reach us.
	if err := nc.Flush(); err != nil {
		d.log.Warn("nats discovery wake flush failed", "err", err)
	}
	d.wakeConn = nc
}

func (d *discovery) broadcastWake() {
	if d.wakeConn == nil {
		return
	}
	if err := d.wakeConn.Publish(discoveryWakeSubject, nil); err != nil {
		d.log.Debug("nats discovery wake publish failed", "err", err)
	}
}

func (d *discovery) close() {
	if d.wakeConn == nil {
		return
	}
	_ = d.wakeConn.FlushTimeout(time.Second)
	d.wakeConn.Close()
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
		case <-d.wake:
			d.tick(ctx)
		}
	}
}

func (d *discovery) tick(ctx context.Context) {
	if err := d.registry.upsert(ctx, d.self); err != nil {
		d.log.Warn("nats peer heartbeat failed", "server_name", d.self.ServerName, "err", err)
		d.failedAt = d.now()
	}
	records, err := d.registry.list(ctx)
	if err != nil {
		d.log.Warn("nats peer discovery degraded", "err", err)
		d.failedAt = d.now()
		// Keep the current routes rather than reconciling to an empty set and
		// tearing down the mesh.
		return
	}
	alive, expired := d.observe(records)
	d.reconcile(alive)
	if len(expired) == 0 {
		return
	}
	// Best effort: the rows are already excluded, and a failed delete is
	// retried on the next tick.
	if err := d.registry.prune(ctx, expired); err != nil {
		d.log.Warn("failed to prune stale nats peers", "peers", len(expired), "err", err)
	}
}

// observe records which rows changed since the last tick and splits the peers
// into those to route to and those whose rows to delete. A peer is excluded
// once its row stays unchanged for longer than the TTL, and stays excluded
// until its row changes.
func (d *discovery) observe(records []peerRecord) (alive []peer, expired []string) {
	now := d.now()
	present := make(map[string]struct{}, len(records))
	for _, rec := range records {
		if rec.ServerName == d.self.ServerName {
			continue
		}
		present[rec.ServerName] = struct{}{}

		obs, seen := d.observed[rec.ServerName]
		if !seen || obs.updatedAt != rec.UpdatedAt {
			if obs.excluded {
				d.log.Info("nats peer heartbeat resumed", "server_name", rec.ServerName)
			}
			obs = observation{updatedAt: rec.UpdatedAt, changedAt: now}
		}

		// While our own heartbeat or reads fail, other peers' likely do too,
		// so silence only counts from the last tick that worked. Otherwise every
		// row would look stale the moment the database comes back.
		since := obs.changedAt
		if d.failedAt.After(since) {
			since = d.failedAt
		}
		age := now.Sub(since)

		if !obs.excluded && age > d.ttl {
			d.log.Info("nats peer heartbeat stale, dropping its route", "server_name", rec.ServerName, "silent_for", age)
			obs.excluded = true
		}
		if !obs.excluded {
			alive = append(alive, peer{ServerName: rec.ServerName, RouteURL: rec.RouteURL})
		}
		if age > d.pruneAfter() {
			expired = append(expired, rec.ServerName)
		}
		d.observed[rec.ServerName] = obs
	}
	maps.DeleteFunc(d.observed, func(name string, _ observation) bool {
		_, ok := present[name]
		return !ok
	})
	return alive, expired
}

func (d *discovery) pruneAfter() time.Duration {
	return pruneAfterTTLs * d.ttl
}

// reconcile reloads the server's routes when the live-peer set has changed; NATS
// solicits new routes and closes removed ones.
func (d *discovery) reconcile(peers []peer) {
	desired := make(map[string]struct{}, len(peers))
	for _, p := range peers {
		// Skip our own row and peers that haven't advertised a route yet.
		if p.ServerName == d.self.ServerName || p.RouteURL == "" {
			continue
		}
		desired[p.RouteURL] = struct{}{}
	}

	if maps.Equal(d.routes, desired) {
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
		if u.Scheme != "nats" && u.Scheme != "tls" {
			d.log.Warn("skipping invalid peer route url scheme", "url", r, "scheme", u.Scheme)
			continue
		}
		urls = append(urls, u)
	}

	return d.reload(urls)
}

// deregister removes this node's row and wakes the peers so they stop dialing it
// now instead of on their next tick. Best-effort: the peers' liveness checks are
// the backstop.
func (d *discovery) deregister(ctx context.Context) {
	if err := d.registry.remove(ctx, d.self.ServerName); err != nil {
		d.log.Warn("failed to deregister nats peer", "server_name", d.self.ServerName, "err", err)
	}
	d.broadcastWake()
}

// peerRecord is the JSON value stored per peer under kv.NATSPeersSection.
// UpdatedAt is the writer's epoch seconds. Observers only check whether it
// changed, never compare it with their own clock.
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

func (s *kvPeerStore) list(ctx context.Context) ([]peerRecord, error) {
	records := make([]peerRecord, 0)
	for rec, err := range s.records(ctx) {
		if err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

func (s *kvPeerStore) prune(ctx context.Context, serverNames []string) error {
	keys := make([]string, 0, len(serverNames))
	for _, name := range serverNames {
		keys = append(keys, s.peerKey(name))
	}
	for chunk := range slices.Chunk(keys, maxPeerDeleteBatch) {
		if err := s.kv.BatchDelete(ctx, kv.NATSPeersSection, chunk); err != nil {
			return err
		}
	}
	return nil
}

func (s *kvPeerStore) remove(ctx context.Context, serverName string) error {
	return s.kv.Delete(ctx, kv.NATSPeersSection, s.peerKey(serverName))
}

// records iterates this cluster's peer records in two round-trips: one Keys scan
// over the cluster's prefix range, then one BatchGet for their values. A row that
// vanishes between the two (a concurrent prune/remove) simply won't appear in the
// BatchGet result, so it's skipped rather than failing the whole read.
func (s *kvPeerStore) records(ctx context.Context) func(func(peerRecord, error) bool) {
	prefix := s.clusterName + "/"
	return func(yield func(peerRecord, error) bool) {
		var keys []string
		for key, err := range s.kv.Keys(ctx, kv.NATSPeersSection, kv.ListOptions{
			StartKey: prefix,
			EndKey:   kv.PrefixRangeEnd(prefix),
		}) {
			if err != nil {
				yield(peerRecord{}, err)
				return
			}
			keys = append(keys, key)
		}
		if len(keys) == 0 {
			return
		}

		for kvp, err := range s.kv.BatchGet(ctx, kv.NATSPeersSection, keys) {
			if err != nil {
				yield(peerRecord{}, err)
				return
			}
			rec, err := decodePeer(kvp)
			if err != nil {
				yield(peerRecord{}, err)
				return
			}
			if !yield(rec, nil) {
				return
			}
		}
	}
}

func decodePeer(kvp kv.KeyValue) (peerRecord, error) {
	defer func() { _ = kvp.Value.Close() }()

	data, err := io.ReadAll(kvp.Value)
	if err != nil {
		return peerRecord{}, err
	}

	var rec peerRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return peerRecord{}, fmt.Errorf("decode nats peer %q: %w", kvp.Key, err)
	}
	return rec, nil
}

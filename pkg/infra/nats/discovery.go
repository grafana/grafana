package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"

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
	defaultDiscoveryTTL      = 15 * time.Second

	// discoveryWakeSubject carries a best-effort "something changed" hint over
	// the cluster mesh so peers that already share a route can reconcile before
	// their next periodic tick instead of waiting up to interval. It only ever
	// reaches nodes already meshed with the sender, so it accelerates joins and
	// graceful leaves but cannot itself bootstrap a brand-new node's discovery
	// (that still relies on the DB-backed periodic tick, same as today).
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
	// listActive returns every peer whose heartbeat is within ttl, pruning rows
	// older than ttl as a side effect (self-healing via re-registration). Pruning
	// is best-effort: the returned set already excludes stale peers, so a failed
	// delete only leaves rows to be retried next tick.
	listActive(ctx context.Context, ttl time.Duration) ([]peer, error)
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
	metrics  *serverMetrics

	// routes is the applied peer route set; only touched by the loop goroutine.
	routes map[string]struct{}

	// wake lets the accelerator below (or any future non-periodic signal)
	// request an early tick(). Buffered by one so a burst of hints coalesces
	// into a single early tick rather than queuing one per hint.
	wake chan struct{}

	// wakeConn is an in-process NATS client used only to broadcast/receive
	// discoveryWakeSubject hints. It is a pure accelerator: nil (connectWake
	// failed) or any publish error just means changes are found on the next
	// periodic tick instead, exactly like before this existed.
	wakeConn *natsclient.Conn
}

// discoveryOptions bundles the embedded server's base options with the
// discovery loop cadence. baseOpts is the template applyRoutes reloads routes
// from; interval/ttl fall back to package defaults when non-positive.
type discoveryOptions struct {
	baseOpts natsserver.Options
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
	d := &discovery{
		log:      logger,
		server:   server,
		baseOpts: opts.baseOpts,
		registry: registry,
		self:     self,
		interval: interval,
		ttl:      ttl,
		metrics:  opts.metrics,
		routes:   map[string]struct{}{},
		wake:     make(chan struct{}, 1),
	}
	d.connectWake()
	return d
}

// connectWake best-effort dials this node's own embedded server in-process and
// subscribes to discoveryWakeSubject. Any failure here just leaves wakeConn
// nil, so the caller keeps running on periodic ticks alone.
func (d *discovery) connectWake() {
	nc, err := natsclient.Connect(d.server.ClientURL(),
		natsclient.InProcessServer(d.server),
		natsclient.Name("grafana-nats-discovery-wake"),
		natsclient.NoEcho(),
		natsclient.Timeout(2*time.Second),
	)
	if err != nil {
		d.log.Warn("nats discovery wake accelerator unavailable; relying on periodic ticks only", "err", err)
		return
	}
	if _, err := nc.Subscribe(discoveryWakeSubject, func(*natsclient.Msg) {
		d.metrics.incWakeReceived()
		d.requestWake()
	}); err != nil {
		d.log.Warn("nats discovery wake subscribe failed; relying on periodic ticks only", "err", err)
		nc.Close()
		return
	}
	d.wakeConn = nc
}

// requestWake asks the run loop for an early tick(). Non-blocking: with the
// wake channel already full, a tick is already pending, so this is a no-op.
func (d *discovery) requestWake() {
	select {
	case d.wake <- struct{}{}:
	default:
	}
}

// broadcastWake best-effort hints already-connected peers that something
// changed, so they can reconcile before their next periodic tick. It never
// affects correctness: a peer that misses the hint (or isn't meshed with this
// node yet) still converges on its own next tick.
func (d *discovery) broadcastWake() {
	if d.wakeConn == nil {
		return
	}
	if err := d.wakeConn.Publish(discoveryWakeSubject, nil); err != nil {
		d.log.Debug("nats discovery wake publish failed", "err", err)
		return
	}
	d.metrics.incWakeSent()
}

// close releases the wake accelerator's connection, flushing first so a hint
// published just before shutdown (see deregister) still reaches peers. Safe to
// call even when connectWake never established a connection.
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
	}
	// One scan per tick: listActive returns the live peers and prunes stale rows.
	peers, err := d.registry.listActive(ctx, d.ttl)
	if err != nil {
		d.log.Warn("nats peer discovery degraded", "err", err)
		// A read failure yields no peers; keep the current routes rather than
		// reconciling to an empty set and tearing down the mesh. A prune failure
		// still returns the valid peer set, so we fall through and reconcile.
		if peers == nil {
			return
		}
	}
	d.reconcile(peers)
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

	if sameRouteSet(d.routes, desired) {
		return
	}

	if err := d.applyRoutes(desired); err != nil {
		d.log.Error("failed to apply nats cluster routes", "err", err)
		return
	}
	d.routes = desired
	d.log.Info("reconciled nats cluster routes", "peers", len(desired))
	d.broadcastWake()
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
	// Hint already-connected peers to drop this node's route now rather than
	// waiting for their next tick or the TTL prune.
	d.broadcastWake()
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

func (s *kvPeerStore) listActive(ctx context.Context, ttl time.Duration) ([]peer, error) {
	cutoff := s.now().Add(-ttl).Unix()
	peers := make([]peer, 0)
	var stale []string
	for rec, err := range s.records(ctx) {
		if err != nil {
			return nil, err
		}
		if rec.UpdatedAt < cutoff {
			stale = append(stale, s.peerKey(rec.ServerName))
			continue
		}
		peers = append(peers, peer{ServerName: rec.ServerName, RouteURL: rec.RouteURL})
	}
	// Best-effort prune in one round-trip; the active set above already excludes
	// these, so a failed delete just leaves them for the next tick.
	if len(stale) > 0 {
		if err := s.kv.BatchDelete(ctx, kv.NATSPeersSection, stale); err != nil {
			return peers, err
		}
	}
	return peers, nil
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

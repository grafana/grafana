package nats

import (
	"context"
	"errors"
	"maps"
	"net/url"
	"slices"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

var errRegistryDown = errors.New("registry down")

// peerTable is the shared in-memory registry table behind fakeRegistry views.
type peerTable struct {
	mu     sync.Mutex
	rows   map[string]peerRecord
	down   bool
	pruned []string
}

// fakeRegistry is one pod's view of a peerTable. Each view writes UpdatedAt
// with its own clock, time.Now shifted by offset, so tests can skew writers
// against the observer.
type fakeRegistry struct {
	*peerTable
	offset time.Duration
}

func newFakeRegistry() *fakeRegistry {
	return &fakeRegistry{peerTable: &peerTable{rows: map[string]peerRecord{}}}
}

// writer returns another pod's view of the same table.
func (f *fakeRegistry) writer(offset time.Duration) *fakeRegistry {
	return &fakeRegistry{peerTable: f.peerTable, offset: offset}
}

func (f *fakeRegistry) upsert(_ context.Context, p peer) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.down {
		return errRegistryDown
	}
	f.rows[p.ServerName] = peerRecord{ServerName: p.ServerName, RouteURL: p.RouteURL, UpdatedAt: time.Now().Add(f.offset).Unix()}
	return nil
}

func (t *peerTable) list(context.Context) ([]peerRecord, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.down {
		return nil, errRegistryDown
	}
	records := make([]peerRecord, 0, len(t.rows))
	for _, rec := range t.rows {
		records = append(records, rec)
	}
	return records, nil
}

func (t *peerTable) prune(_ context.Context, serverNames []string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.down {
		return errRegistryDown
	}
	for _, name := range serverNames {
		delete(t.rows, name)
	}
	t.pruned = append(t.pruned, serverNames...)
	return nil
}

func (t *peerTable) remove(_ context.Context, serverName string) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.down {
		return errRegistryDown
	}
	delete(t.rows, serverName)
	return nil
}

func (t *peerTable) setDown(down bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.down = down
}

func (t *peerTable) has(serverName string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	_, ok := t.rows[serverName]
	return ok
}

func (t *peerTable) prunedNames() []string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return slices.Clone(t.pruned)
}

// newTestDiscovery builds a discovery against a clustered in-process server so
// applyRoutes exercises the real ReloadOptions route-solicitation path. Ports are
// OS-assigned (-1) to avoid collisions; the advertised peer routes are unreachable
// stubs, which NATS solicits asynchronously without failing the reload.
func newTestDiscovery(t *testing.T, reg peerRegistry, self peer) *discovery {
	t.Helper()
	return newTestDiscoveryWith(t, reg, self, discoveryOptions{})
}

// newTestDiscoveryWith is newTestDiscovery with the given interval and ttl.
func newTestDiscoveryWith(t *testing.T, reg peerRegistry, self peer, dopts discoveryOptions) *discovery {
	t.Helper()
	opts := natsserver.Options{
		Host:            "127.0.0.1",
		Port:            -1,
		NoLog:           true,
		NoSigs:          true,
		JetStream:       false,
		NoSystemAccount: true,
		Cluster:         natsserver.ClusterOpts{Name: discoveryClusterName, Host: "127.0.0.1", Port: -1},
	}
	srv, err := natsserver.NewServer(&opts)
	require.NoError(t, err)
	go srv.Start()
	require.True(t, srv.ReadyForConnections(5*time.Second), "test nats server not ready")
	t.Cleanup(srv.Shutdown)
	reload := func(routes []*url.URL) error {
		next := opts
		next.Routes = routes
		return srv.ReloadOptions(&next)
	}
	dopts.reload = reload
	dopts.metrics = newServerMetrics(prometheus.NewRegistry(), func() int { return 0 })
	return newDiscovery(log.NewNopLogger(), srv, reg, self, dopts)
}

// newSteppedDiscovery builds a discovery with no NATS server behind it, so it
// can run in a synctest bubble. Tests call tick themselves.
func newSteppedDiscovery(reg peerRegistry, self peer) *discovery {
	return &discovery{
		log:      log.NewNopLogger(),
		reload:   func([]*url.URL) error { return nil },
		registry: reg,
		self:     self,
		interval: defaultDiscoveryInterval,
		ttl:      defaultDiscoveryTTL,
		now:      time.Now,
		routes:   map[string]struct{}{},
		observed: map[string]observation{},
	}
}

// testPeer is a pod writing its heartbeat through its own registry view.
type testPeer struct {
	peer
	reg *fakeRegistry
}

func newTestPeer(reg *fakeRegistry, name, routeURL string, offset time.Duration) testPeer {
	return testPeer{peer: peer{ServerName: name, RouteURL: routeURL}, reg: reg.writer(offset)}
}

func (p testPeer) heartbeat(t *testing.T) {
	t.Helper()
	require.NoError(t, p.reg.upsert(t.Context(), p.peer))
}

func routesTo(peers ...testPeer) map[string]struct{} {
	routes := make(map[string]struct{}, len(peers))
	for _, p := range peers {
		routes[p.RouteURL] = struct{}{}
	}
	return routes
}

var observerSelf = peer{ServerName: "self", RouteURL: "nats://10.0.0.1:6222"}

func TestDiscoveryReconcile(t *testing.T) {
	ctx := context.Background()

	t.Run("adds peer routes and skips self and empty routes", func(t *testing.T) {
		reg := newFakeRegistry()
		require.NoError(t, reg.upsert(ctx, observerSelf))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-a", RouteURL: "nats://10.0.0.2:6222"}))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-b", RouteURL: "nats://10.0.0.3:6222"}))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-empty", RouteURL: ""}))

		d := newTestDiscovery(t, reg, observerSelf)
		d.tick(ctx)

		require.Equal(t, map[string]struct{}{
			"nats://10.0.0.2:6222": {},
			"nats://10.0.0.3:6222": {},
		}, d.routes)
	})

	t.Run("deregister removes self", func(t *testing.T) {
		reg := newFakeRegistry()
		d := newTestDiscovery(t, reg, observerSelf)
		require.NoError(t, reg.upsert(ctx, observerSelf))

		d.deregister(ctx)

		require.False(t, reg.has(observerSelf.ServerName))
	})

	t.Run("raises a ttl shorter than heartbeats can be told apart", func(t *testing.T) {
		interval := 100 * time.Millisecond
		d := newTestDiscoveryWith(t, newFakeRegistry(), observerSelf, discoveryOptions{interval: interval, ttl: 500 * time.Millisecond})
		require.Equal(t, minDiscoveryTTL(interval), d.ttl)

		d = newTestDiscoveryWith(t, newFakeRegistry(), observerSelf, discoveryOptions{interval: interval, ttl: time.Minute})
		require.Equal(t, time.Minute, d.ttl)
	})
}

func TestDiscoveryLiveness(t *testing.T) {
	t.Run("keeps peers whose clocks are skewed while they heartbeat", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			ahead := newTestPeer(reg, "ahead", "nats://10.0.0.2:6222", time.Hour)
			behind := newTestPeer(reg, "behind", "nats://10.0.0.3:6222", -time.Hour)
			d := newSteppedDiscovery(reg, observerSelf)

			for elapsed := time.Duration(0); elapsed <= 3*d.pruneAfter(); elapsed += d.interval {
				ahead.heartbeat(t)
				behind.heartbeat(t)
				d.tick(t.Context())
				require.Equal(t, routesTo(ahead, behind), d.routes, "after %s", elapsed)
				time.Sleep(d.interval)
			}
			require.Empty(t, reg.prunedNames())
		})
	})

	t.Run("keeps peers routed at the shortest ttl with subsecond heartbeats", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			// A fractional offset puts the writer's second boundaries between
			// the observer's ticks.
			p := newTestPeer(reg, "peer", "nats://10.0.0.2:6222", 370*time.Millisecond)
			d := newSteppedDiscovery(reg, observerSelf)
			d.interval = 100 * time.Millisecond
			d.ttl = minDiscoveryTTL(d.interval)

			p.heartbeat(t)
			for elapsed := time.Duration(0); elapsed <= time.Minute; elapsed += d.interval {
				d.tick(t.Context())
				require.Equal(t, routesTo(p), d.routes, "after %s", elapsed)
				// Heartbeat right after the observer's tick, the latest it can
				// see the change.
				time.Sleep(time.Millisecond)
				p.heartbeat(t)
				time.Sleep(d.interval - time.Millisecond)
			}
		})
	})

	t.Run("drops a silent peer after the ttl and deletes its row later", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			live := newTestPeer(reg, "live", "nats://10.0.0.2:6222", 0)
			silent := newTestPeer(reg, "silent", "nats://10.0.0.3:6222", 0)
			d := newSteppedDiscovery(reg, observerSelf)

			silent.heartbeat(t)
			for elapsed := time.Duration(0); elapsed <= d.pruneAfter()+2*d.interval; elapsed += d.interval {
				live.heartbeat(t)
				d.tick(t.Context())
				if elapsed <= d.ttl {
					require.Equal(t, routesTo(live, silent), d.routes, "after %s", elapsed)
				} else {
					require.Equal(t, routesTo(live), d.routes, "after %s", elapsed)
				}
				require.Equal(t, elapsed <= d.pruneAfter(), reg.has(silent.ServerName), "after %s", elapsed)
				time.Sleep(d.interval)
			}
			require.Equal(t, []string{silent.ServerName}, reg.prunedNames())
			require.NotContains(t, d.observed, silent.ServerName)
		})
	})

	t.Run("keeps a peer that resumes before its row is deleted", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			flaky := newTestPeer(reg, "flaky", "nats://10.0.0.2:6222", 0)
			d := newSteppedDiscovery(reg, observerSelf)

			flaky.heartbeat(t)
			d.tick(t.Context())
			time.Sleep(d.ttl + d.interval)
			d.tick(t.Context())
			require.Empty(t, d.routes)
			require.True(t, reg.has(flaky.ServerName))

			for range 3 * pruneAfterTTLs * int(d.ttl/d.interval) {
				flaky.heartbeat(t)
				d.tick(t.Context())
				require.Equal(t, routesTo(flaky), d.routes)
				time.Sleep(d.interval)
			}
			require.Empty(t, reg.prunedNames())
		})
	})

	t.Run("an outage longer than the ttl neither drops routes nor deletes rows", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			live := newTestPeer(reg, "live", "nats://10.0.0.2:6222", 0)
			dead := newTestPeer(reg, "dead", "nats://10.0.0.3:6222", 0)
			d := newSteppedDiscovery(reg, observerSelf)

			live.heartbeat(t)
			dead.heartbeat(t)
			d.tick(t.Context())
			require.Equal(t, routesTo(live, dead), d.routes)

			// dead goes silent as the outage starts.
			reg.setDown(true)
			for elapsed := time.Duration(0); elapsed <= 2*d.pruneAfter(); elapsed += d.interval {
				time.Sleep(d.interval)
				require.ErrorIs(t, live.reg.upsert(t.Context(), live.peer), errRegistryDown)
				d.tick(t.Context())
				require.Equal(t, routesTo(live, dead), d.routes, "after %s", elapsed)
			}
			lastFailure := time.Now()
			reg.setDown(false)

			for {
				time.Sleep(d.interval)
				live.heartbeat(t)
				d.tick(t.Context())
				sinceRecovery := time.Since(lastFailure)
				if sinceRecovery <= d.ttl {
					require.Equal(t, routesTo(live, dead), d.routes, "%s after recovery", sinceRecovery)
					continue
				}
				require.Equal(t, routesTo(live), d.routes, "%s after recovery", sinceRecovery)
				break
			}
			require.True(t, reg.has(dead.ServerName))
			require.Empty(t, reg.prunedNames())
		})
	})

	t.Run("a failed heartbeat alone also defers expiry", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			dead := newTestPeer(reg, "dead", "nats://10.0.0.2:6222", 0)
			failing := &failingUpsertRegistry{fakeRegistry: reg}
			d := newSteppedDiscovery(failing, observerSelf)

			dead.heartbeat(t)
			d.tick(t.Context())
			failing.failing = true
			time.Sleep(d.ttl)
			d.tick(t.Context())
			failing.failing = false
			time.Sleep(d.ttl)
			d.tick(t.Context())
			require.Equal(t, routesTo(dead), d.routes)

			time.Sleep(d.interval)
			d.tick(t.Context())
			require.Empty(t, d.routes)
		})
	})

	t.Run("failures never bring back a peer found silent", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			silent := newTestPeer(reg, "silent", "nats://10.0.0.2:6222", 0)
			failing := &failingUpsertRegistry{fakeRegistry: reg}
			d := newSteppedDiscovery(failing, observerSelf)

			silent.heartbeat(t)
			d.tick(t.Context())
			time.Sleep(d.ttl + d.interval)
			d.tick(t.Context())
			require.Empty(t, d.routes)

			// A failed heartbeat, then a failed read followed by recovery.
			time.Sleep(d.interval)
			failing.failing = true
			d.tick(t.Context())
			require.Empty(t, d.routes)
			failing.failing = false
			time.Sleep(d.interval)
			reg.setDown(true)
			d.tick(t.Context())
			lastFailure := time.Now()
			reg.setDown(false)

			// The row is still deleted, only later.
			for reg.has(silent.ServerName) {
				time.Sleep(d.interval)
				d.tick(t.Context())
				require.Empty(t, d.routes)
				require.Equal(t, time.Since(lastFailure) <= d.pruneAfter(), reg.has(silent.ServerName))
			}
		})
	})

	t.Run("a fresh observer trusts existing rows for one ttl", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			live := newTestPeer(reg, "live", "nats://10.0.0.2:6222", 0)
			dead := newTestPeer(reg, "dead", "nats://10.0.0.3:6222", -time.Hour)
			dead.heartbeat(t)
			time.Sleep(time.Hour)
			d := newSteppedDiscovery(reg, observerSelf)

			for elapsed := time.Duration(0); elapsed <= d.ttl+d.interval; elapsed += d.interval {
				live.heartbeat(t)
				d.tick(t.Context())
				if elapsed <= d.ttl {
					require.Equal(t, routesTo(live, dead), d.routes, "after %s", elapsed)
				} else {
					require.Equal(t, routesTo(live), d.routes, "after %s", elapsed)
				}
				time.Sleep(d.interval)
			}
		})
	})

	t.Run("forgets peers whose rows disappear", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			live := newTestPeer(reg, "live", "nats://10.0.0.2:6222", 0)
			leaving := newTestPeer(reg, "leaving", "nats://10.0.0.3:6222", 0)
			prunedElsewhere := newTestPeer(reg, "pruned-elsewhere", "nats://10.0.0.4:6222", 0)
			d := newSteppedDiscovery(reg, observerSelf)

			live.heartbeat(t)
			leaving.heartbeat(t)
			prunedElsewhere.heartbeat(t)
			d.tick(t.Context())
			require.Equal(t, routesTo(live, leaving, prunedElsewhere), d.routes)

			require.NoError(t, leaving.reg.remove(t.Context(), leaving.ServerName))
			require.NoError(t, reg.writer(0).prune(t.Context(), []string{prunedElsewhere.ServerName}))
			time.Sleep(d.interval)
			live.heartbeat(t)
			d.tick(t.Context())

			require.Equal(t, routesTo(live), d.routes)
			require.Equal(t, []string{live.ServerName}, slices.Collect(maps.Keys(d.observed)))
		})
	})

	t.Run("ages a row from its last change however often it looks", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			reg := newFakeRegistry()
			p := newTestPeer(reg, "peer", "nats://10.0.0.2:6222", 0)
			d := newSteppedDiscovery(reg, observerSelf)

			p.heartbeat(t)
			lastBeat := time.Now()
			for time.Since(lastBeat) <= d.ttl {
				d.tick(t.Context())
				require.Equal(t, routesTo(p), d.routes)
				time.Sleep(time.Second)
			}
			d.tick(t.Context())
			require.Empty(t, d.routes)
		})
	})
}

// failingUpsertRegistry fails only this pod's heartbeat while reads succeed.
type failingUpsertRegistry struct {
	*fakeRegistry
	failing bool
}

func (f *failingUpsertRegistry) upsert(ctx context.Context, p peer) error {
	if f.failing {
		return errRegistryDown
	}
	return f.fakeRegistry.upsert(ctx, p)
}

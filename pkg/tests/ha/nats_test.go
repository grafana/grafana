package ha

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

const (
	discoveryInterval = 500 * time.Millisecond
	discoveryTTL      = 3 * time.Second
	// hangGuard bounds every wait so a broken cluster fails instead of hanging.
	// No assertion depends on it.
	hangGuard = 30 * time.Second
	// peerKeyPrefix is the discovery row key prefix: the embedded cluster name.
	peerKeyPrefix = "grafana/"
	probeHeader   = "X-Test-Probe"
)

var (
	folderGVR   = schema.GroupVersionResource{Group: "folder.grafana.app", Resource: "folders"}
	playlistGVR = schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v1", Resource: "playlists"}
)

const (
	// pollerQueryMetric observes every resource_history poll of the legacy SQL
	// polling notifier, before the polled events reach a watch.
	pollerQueryMetric = "grafana_storage_server_poller_query_latency_seconds"
	// sqlNATSNotifierMetric is registered only when the legacy SQL backend
	// builds its NATS notifier, which replaces the polling one.
	sqlNATSNotifierMetric = "grafana_storage_server_sql_watch_missing_events_total"
	// kvNATSNotifierMetric is registered with every KV backend, but only the KV
	// NATS notifier, which replaces the polling one, creates its series.
	kvNATSNotifierMetric = "grafana_storage_server_nats_notifier_dropped_events_total"
)

func natsNodeOpts(sqlKV bool) testinfra.GrafanaOpts {
	return testinfra.GrafanaOpts{
		NATSEnabled:           true,
		NATSListenAddress:     "127.0.0.1",
		NATSAdvertiseAddress:  "127.0.0.1",
		NATSClientPort:        natsserver.RANDOM_PORT,
		NATSClusterPort:       natsserver.RANDOM_PORT,
		NATSDiscoveryEnabled:  true,
		NATSDiscoveryInterval: discoveryInterval,
		NATSDiscoveryTTL:      discoveryTTL,
		EnableSQLKVBackend:    sqlKV,
	}
}

// TestIntegrationNATSEmbeddedCluster runs three Grafana servers on one database
// with embedded NATS, as an HA cluster does, on the legacy SQL and the KV
// storage backends. They find each other through the discovery table, a write on
// one reaches bus subscribers and API watches on the others without any node
// polling the database, and a node that leaves is dropped from the peers' routes.
func TestIntegrationNATSEmbeddedCluster(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Skip("NATS informer mechanisms have no SDK implementation yet; the supplier refuses keyed kinds under NATS")

	t.Run("legacy SQL", func(t *testing.T) { testNATSEmbeddedCluster(t, false) })
	t.Run("KV", func(t *testing.T) { testNATSEmbeddedCluster(t, true) })
}

func testNATSEmbeddedCluster(t *testing.T, sqlKV bool) {
	cluster := testinfra.NewGrafanaCluster(t)
	events := newServerEvents()
	start := func() (*testinfra.ClusterNode, *natsserver.Server) {
		node := cluster.StartNode(natsNodeOpts(sqlKV))
		srv := testinfra.EmbeddedNATSServer(t, node.Env)
		events.watch(srv)
		return node, srv
	}
	// A is watched before B and C join, so A logs each route it registers.
	a, srvA := start()
	b, srvB := start()
	c, srvC := start()

	events.waitFor(t, "A to route to B and C", func() bool { return routedTo(t, srvA, srvB, srvC) })

	t.Run("a write on one node reaches subscribers on the others", func(t *testing.T) {
		subject := resourcewatch.Subject(folderGVR, "default")
		ncB, notificationsB := subscribe(t, b, subject)
		ncC, notificationsC := subscribe(t, c, subject)
		awaitInterest(t, testinfra.ConnectNATS(t, a.Env), subject, ncB, ncC)

		uid := createFolder(t, a.Addr, "nats-ha-folder")

		for name, notifications := range map[string]<-chan *resourcepb.WatchNotification{"B": notificationsB, "C": notificationsC} {
			n := expectNotification(t, notifications, uid)
			require.Equal(t, resourcepb.WatchNotification_ADDED, n.Type, name)
			require.Equal(t, folderGVR.Group, n.Group, name)
			require.Equal(t, folderGVR.Resource, n.Resource, name)
			require.Equal(t, "default", n.Namespace, name)
			require.Positive(t, n.ResourceVersion, name)
		}
	})

	t.Run("a watch on one node gets the writes made through another", func(t *testing.T) {
		ctx := t.Context()
		onA, onB := playlists(t, a), playlists(t, b)

		w, err := onB.Watch(ctx, metav1.ListOptions{
			SendInitialEvents:    ptr.To(true),
			ResourceVersionMatch: metav1.ResourceVersionMatchNotOlderThan,
			AllowWatchBookmarks:  true,
		})
		require.NoError(t, err)
		t.Cleanup(w.Stop)
		// B's storage subscribes to the bus before it serves a watch, so this
		// bookmark means its subscription is in place. Route interest travels in
		// order, so once a later subscription on B gets a probe from A, A also
		// forwards the writes below to B's storage. On KV the bookmark and the
		// events wait for its longer settle delay.
		awaitInitialEventsEnd(t, w)
		subject := resourcewatch.Subject(playlistGVR, "default")
		awaitInterest(t, testinfra.ConnectNATS(t, a.Env), subject, testinfra.ConnectNATS(t, b.Env))

		created, err := onA.Create(ctx, newPlaylist("nats-ha-playlist", "created on A"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedField(created.Object, "updated on A", "spec", "title"))
		updated, err := onA.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NoError(t, onA.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))

		added := expectWatchEvent(t, w, watch.Added, created.GetName())
		require.Equal(t, created.GetResourceVersion(), added.GetResourceVersion())
		require.Equal(t, "created on A", playlistTitle(t, added))

		modified := expectWatchEvent(t, w, watch.Modified, created.GetName())
		require.Equal(t, updated.GetResourceVersion(), modified.GetResourceVersion())
		require.Equal(t, "updated on A", playlistTitle(t, modified))

		deleted := expectWatchEvent(t, w, watch.Deleted, created.GetName())
		require.Greater(t, resourceVersion(t, deleted), resourceVersion(t, modified))
	})

	// This runs after the writes above instead of over an idle window: a polling
	// notifier reads resource_history only once the latest RVs change, and a
	// polling B can only have delivered those writes to its watch after such a
	// read, so its zero count involves no timing. The notifier is chosen once at
	// startup, so the NATS one being in place also rules out the polling loop,
	// which reads the latest RVs on every tick.
	t.Run("no node polls the database for watches", func(t *testing.T) {
		for name, node := range map[string]*testinfra.ClusterNode{"A": a, "B": b, "C": c} {
			families := scrapeMetrics(t, node.Addr)
			if sqlKV {
				// The KV polling notifier has no metric of its own; the NATS
				// notifier being in place is the signal that it is not running.
				_, ok := families[kvNATSNotifierMetric]
				require.True(t, ok, "node %s does not use the KV NATS notifier", name)
				continue
			}
			poller, ok := families[pollerQueryMetric]
			require.True(t, ok, "node %s exposes no %s", name, pollerQueryMetric)
			require.Len(t, poller.GetMetric(), 1)
			require.Zero(t, poller.GetMetric()[0].GetHistogram().GetSampleCount(), "node %s polled resource_history", name)
			_, ok = families[sqlNATSNotifierMetric]
			require.True(t, ok, "node %s does not use the legacy SQL NATS notifier", name)
		}
	})

	// Discovery and routes don't depend on the storage backend, so the
	// membership checks run once.
	if sqlKV {
		return
	}

	t.Run("a stopped node leaves the peers' routes within one interval", func(t *testing.T) {
		portC := clusterPort(srvC)
		// Live routes can form before discovery has applied C's row, so wait for
		// it, or the drop below could pass without one.
		events.waitFor(t, "A and B to route to C through discovery", func() bool {
			return hasRoute(t, srvB, portC) && hasRoute(t, srvA, portC)
		})
		c.Stop()
		stoppedAt := time.Now()
		// A graceful stop removes the peer row, so the TTL plays no part.
		events.waitFor(t, "A and B to drop the stopped node", func() bool {
			return !hasRoute(t, srvB, portC) && !hasRoute(t, srvA, portC)
		})
		require.LessOrEqual(t, time.Since(stoppedAt), discoveryInterval+time.Second)
	})

	t.Run("a killed node leaves the peers' routes within the TTL plus one interval", func(t *testing.T) {
		store, err := kv.NewSQLKV(b.Env.SQLStore.GetEngine().DB().DB, b.Env.SQLStore.GetDialect().DriverName())
		require.NoError(t, err)
		ctx := t.Context()
		key := peerKeyPrefix + srvA.Name()
		portA := clusterPort(srvA)
		row := readPeerRow(t, ctx, store, key)

		events.waitFor(t, "B to route to A through discovery", func() bool { return hasRoute(t, srvB, portA) })

		// A killed process never deregisters. Simulate that by putting A's row back
		// after a graceful stop, heartbeating now, so the shutdown time doesn't count.
		// Restore it only once B dropped A's old route, so a tick that read the
		// missing row can't remove the route after the restore.
		a.Stop()
		events.waitFor(t, "B to drop the stopped node", func() bool { return !hasRoute(t, srvB, portA) })
		killedAt := time.Now()
		writePeerRow(t, ctx, store, key, withHeartbeat(t, row, killedAt))

		events.waitFor(t, "B to route to the killed node while its row is fresh", func() bool { return hasRoute(t, srvB, portA) })
		events.waitFor(t, "B to drop the killed node", func() bool { return !hasRoute(t, srvB, portA) })
		// The heartbeat has one-second resolution, so the drop can land up to a
		// second after the TTL plus one interval; the rest covers B's route reload.
		elapsed := time.Since(killedAt)
		require.GreaterOrEqual(t, elapsed, discoveryTTL, "B dropped the killed node before the TTL")
		require.LessOrEqual(t, elapsed, discoveryTTL+discoveryInterval+2*time.Second, "B kept the killed node past the TTL")
	})
}

// serverEvents wakes waiters whenever a watched embedded server logs. nats-server
// has no route callbacks, but it logs right after it registers a route or
// reloads its route set, so re-checking the state on each log line is enough.
type serverEvents struct {
	wake chan struct{}
}

func newServerEvents() *serverEvents {
	return &serverEvents{wake: make(chan struct{}, 1)}
}

// watch chains a logger in front of the one Grafana set, and turns on debug so
// route registrations are logged.
func (e *serverEvents) watch(srv *natsserver.Server) {
	srv.SetLogger(wakeLogger{next: srv.Logger(), wake: e.wake}, true, false)
}

func (e *serverEvents) waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	guard := time.NewTimer(hangGuard)
	defer guard.Stop()
	for !cond() {
		select {
		case <-e.wake:
		case <-guard.C:
			t.Fatalf("timed out waiting for %s", what)
		}
	}
}

type wakeLogger struct {
	next natsserver.Logger
	wake chan struct{}
}

var _ natsserver.Logger = wakeLogger{}

func (l wakeLogger) signal() {
	select {
	case l.wake <- struct{}{}:
	default:
	}
}

func (l wakeLogger) Noticef(format string, v ...any) {
	if l.next != nil {
		l.next.Noticef(format, v...)
	}
	l.signal()
}

func (l wakeLogger) Warnf(format string, v ...any) {
	if l.next != nil {
		l.next.Warnf(format, v...)
	}
	l.signal()
}

func (l wakeLogger) Fatalf(format string, v ...any) {
	if l.next != nil {
		l.next.Fatalf(format, v...)
	}
	l.signal()
}

func (l wakeLogger) Errorf(format string, v ...any) {
	if l.next != nil {
		l.next.Errorf(format, v...)
	}
	l.signal()
}

func (l wakeLogger) Debugf(format string, v ...any) {
	if l.next != nil {
		l.next.Debugf(format, v...)
	}
	l.signal()
}

func (l wakeLogger) Tracef(format string, v ...any) {
	if l.next != nil {
		l.next.Tracef(format, v...)
	}
	l.signal()
}

// routedTo reports whether srv has a live route to each of peers.
func routedTo(t *testing.T, srv *natsserver.Server, peers ...*natsserver.Server) bool {
	t.Helper()
	rz, err := srv.Routez(nil)
	require.NoError(t, err)
	remotes := map[string]bool{}
	for _, r := range rz.Routes {
		remotes[r.RemoteName] = true
	}
	for _, p := range peers {
		if !remotes[p.Name()] {
			return false
		}
	}
	return true
}

// hasRoute reports whether discovery has configured srv to solicit a route to
// the peer listening on port. Unlike Routez, this keeps a dead peer until its
// row is gone, which is what the TTL bounds.
func hasRoute(t *testing.T, srv *natsserver.Server, port string) bool {
	t.Helper()
	vz, err := srv.Varz(nil)
	require.NoError(t, err)
	for _, raw := range vz.Cluster.URLs {
		// Varz drops the scheme; accept both forms.
		hostPort := raw
		if u, err := url.Parse(raw); err == nil && u.Host != "" {
			hostPort = u.Host
		}
		_, p, err := net.SplitHostPort(hostPort)
		if assert.NoError(t, err, raw) && p == port {
			return true
		}
	}
	return false
}

func clusterPort(srv *natsserver.Server) string {
	return strconv.Itoa(srv.ClusterAddr().Port)
}

// subscribe listens for notifications on node's embedded server. Probes from
// awaitInterest share the subject and are skipped.
func subscribe(t *testing.T, node *testinfra.ClusterNode, subject string) (*natsclient.Conn, <-chan *resourcepb.WatchNotification) {
	t.Helper()
	nc := testinfra.ConnectNATS(t, node.Env)
	notifications := make(chan *resourcepb.WatchNotification, 100)
	sub, err := nc.Subscribe(subject, func(msg *natsclient.Msg) {
		if msg.Header.Get(probeHeader) != "" {
			return
		}
		n := &resourcepb.WatchNotification{}
		if err := proto.Unmarshal(msg.Data, n); err != nil {
			n = nil
		}
		notifications <- n
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = sub.Unsubscribe() })
	require.NoError(t, nc.Flush())
	return nc, notifications
}

// awaitInterest returns once a probe published through pub reaches every
// subscriber connection. A subscription reaches the other servers over the
// route asynchronously and nats-server reports no event for it, so a probe is
// the only way to know the next publish on subject won't be dropped. Each probe
// is paced by a flush round trip to the publishing server.
func awaitInterest(t *testing.T, pub *natsclient.Conn, subject string, subscribers ...*natsclient.Conn) {
	t.Helper()
	token := randomToken(t)
	received := make([]chan struct{}, len(subscribers))
	subs := make([]*natsclient.Subscription, len(subscribers))
	for i, nc := range subscribers {
		got := make(chan struct{})
		var once sync.Once
		sub, err := nc.Subscribe(subject, func(msg *natsclient.Msg) {
			if msg.Header.Get(probeHeader) == token {
				once.Do(func() { close(got) })
			}
		})
		require.NoError(t, err)
		require.NoError(t, nc.Flush())
		received[i], subs[i] = got, sub
	}

	deadline := time.Now().Add(hangGuard)
	probes := 0
	for i, got := range received {
		for done := false; !done; {
			select {
			case <-got:
				done = true
			default:
				require.True(t, time.Now().Before(deadline), "probe on %s never reached subscriber %d", subject, i)
				msg := natsclient.NewMsg(subject)
				msg.Header.Set(probeHeader, token)
				require.NoError(t, pub.PublishMsg(msg))
				require.NoError(t, pub.Flush())
				probes++
			}
		}
	}
	t.Logf("every subscriber got a probe after %d probes", probes)

	for _, sub := range subs {
		require.NoError(t, sub.Unsubscribe())
	}
	for _, nc := range subscribers {
		require.NoError(t, nc.Flush())
	}
}

func randomToken(t *testing.T) string {
	t.Helper()
	var b [8]byte
	_, err := rand.Read(b[:])
	require.NoError(t, err)
	return hex.EncodeToString(b[:])
}

func expectNotification(t *testing.T, notifications <-chan *resourcepb.WatchNotification, name string) *resourcepb.WatchNotification {
	t.Helper()
	guard := time.NewTimer(hangGuard)
	defer guard.Stop()
	for {
		select {
		case n := <-notifications:
			require.NotNil(t, n, "undecodable notification")
			if n.Name == name {
				return n
			}
		case <-guard.C:
			t.Fatalf("no notification for %q", name)
			return nil
		}
	}
}

func createFolder(t *testing.T, addr, title string) string {
	t.Helper()
	body, err := json.Marshal(map[string]string{"title": title})
	require.NoError(t, err)
	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, fmt.Sprintf("http://%s/api/folders", addr), bytes.NewReader(body))
	require.NoError(t, err)
	req.SetBasicAuth("admin", "admin")
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	data, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, string(data))
	var folder struct {
		UID string `json:"uid"`
	}
	require.NoError(t, json.Unmarshal(data, &folder))
	require.NotEmpty(t, folder.UID)
	return folder.UID
}

func readPeerRow(t *testing.T, ctx context.Context, store kv.KV, key string) []byte {
	t.Helper()
	r, err := store.Get(ctx, kv.NATSPeersSection, key)
	require.NoError(t, err)
	defer func() { _ = r.Close() }()
	data, err := io.ReadAll(r)
	require.NoError(t, err)
	return data
}

// withHeartbeat returns the discovery row with its heartbeat set to at.
func withHeartbeat(t *testing.T, row []byte, at time.Time) []byte {
	t.Helper()
	var rec map[string]any
	require.NoError(t, json.Unmarshal(row, &rec))
	require.Contains(t, rec, "updatedAt", "discovery row format changed: %s", row)
	rec["updatedAt"] = at.Unix()
	data, err := json.Marshal(rec)
	require.NoError(t, err)
	return data
}

func writePeerRow(t *testing.T, ctx context.Context, store kv.KV, key string, data []byte) {
	t.Helper()
	w, err := store.Save(ctx, kv.NATSPeersSection, key)
	require.NoError(t, err)
	_, err = w.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())
}

// playlists returns a client for the playlists of the default namespace,
// through node's Kubernetes-style API.
func playlists(t *testing.T, node *testinfra.ClusterNode) dynamic.ResourceInterface {
	t.Helper()
	client, err := dynamic.NewForConfig(&rest.Config{
		Host:     "http://" + node.Addr,
		Username: "admin",
		Password: "admin",
	})
	require.NoError(t, err)
	return client.Resource(playlistGVR).Namespace("default")
}

func newPlaylist(name, title string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": playlistGVR.GroupVersion().String(),
		"kind":       "Playlist",
		"metadata":   map[string]any{"name": name},
		"spec": map[string]any{
			"title":    title,
			"interval": "5m",
			"items":    []any{map[string]any{"type": "dashboard_by_tag", "value": "nats-ha"}},
		},
	}}
}

func playlistTitle(t *testing.T, obj *unstructured.Unstructured) string {
	t.Helper()
	title, found, err := unstructured.NestedString(obj.Object, "spec", "title")
	require.NoError(t, err)
	require.True(t, found, "playlist %s has no title", obj.GetName())
	return title
}

func resourceVersion(t *testing.T, obj *unstructured.Unstructured) int64 {
	t.Helper()
	rv, err := strconv.ParseInt(obj.GetResourceVersion(), 10, 64)
	require.NoError(t, err)
	return rv
}

// nextWatchEvent returns the next event other than a periodic bookmark.
func nextWatchEvent(t *testing.T, w watch.Interface) (watch.EventType, *unstructured.Unstructured) {
	t.Helper()
	guard := time.NewTimer(hangGuard)
	defer guard.Stop()
	for {
		select {
		case ev, ok := <-w.ResultChan():
			require.True(t, ok, "watch closed")
			require.NotEqual(t, watch.Error, ev.Type, "watch failed: %v", ev.Object)
			obj, ok := ev.Object.(*unstructured.Unstructured)
			require.True(t, ok, "unexpected watch object %T", ev.Object)
			if ev.Type == watch.Bookmark && obj.GetAnnotations()[metav1.InitialEventsAnnotationKey] != "true" {
				continue
			}
			return ev.Type, obj
		case <-guard.C:
			t.Fatal("timed out waiting for a watch event")
			return "", nil
		}
	}
}

// awaitInitialEventsEnd skips the initial state of a watch opened with
// SendInitialEvents, up to the bookmark that ends it.
func awaitInitialEventsEnd(t *testing.T, w watch.Interface) {
	t.Helper()
	for {
		typ, obj := nextWatchEvent(t, w)
		if typ == watch.Bookmark {
			return
		}
		require.Equal(t, watch.Added, typ, "unexpected %s of %s before the initial events ended", typ, obj.GetName())
	}
}

func expectWatchEvent(t *testing.T, w watch.Interface, want watch.EventType, name string) *unstructured.Unstructured {
	t.Helper()
	typ, obj := nextWatchEvent(t, w)
	require.Equal(t, want, typ, "event for %s", obj.GetName())
	require.Equal(t, name, obj.GetName())
	return obj
}

func scrapeMetrics(t *testing.T, addr string) map[string]*dto.MetricFamily {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, fmt.Sprintf("http://%s/metrics", addr), nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	require.Equal(t, http.StatusOK, resp.StatusCode)
	parser := expfmt.NewTextParser(model.UTF8Validation)
	families, err := parser.TextToMetricFamilies(resp.Body)
	require.NoError(t, err)
	return families
}

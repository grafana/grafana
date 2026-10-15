package setting

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeSubscriber struct {
	enabled     bool
	err         error
	subject     string
	handler     func(subject string, data []byte)
	onReconnect func()
}

func (f *fakeSubscriber) Enabled() bool { return f.enabled }

func (f *fakeSubscriber) Subscribe(_ context.Context, subject string, handler func(string, []byte), onReconnect func()) error {
	if f.err != nil {
		return f.err
	}
	f.subject, f.handler, f.onReconnect = subject, handler, onReconnect
	return nil
}

func (f *fakeSubscriber) publish(t *testing.T, namespace string) {
	t.Helper()
	data, err := proto.Marshal(&resourcepb.WatchNotification{Namespace: namespace, Name: "server--port"})
	require.NoError(t, err)
	f.handler(f.subject, data)
}

func newEventTestClient(t *testing.T, server *httptest.Server, sub EventSubscriber, ttl time.Duration) *remoteSettingService {
	t.Helper()
	client, err := New(Config{
		URL:             server.URL,
		WrapTransport:   func(rt http.RoundTripper) http.RoundTripper { return rt },
		CacheTTL:        ttl,
		EventSubscriber: sub,
	})
	require.NoError(t, err)
	return client.(*remoteSettingService)
}

func invalidations(c *remoteSettingService, reason string) float64 {
	return testutil.ToFloat64(c.metrics.cacheInvalidationTotal.WithLabelValues(reason))
}

func countingServer(t *testing.T, requests *atomic.Int32) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(generateSettingsJSON([]Setting{{Section: "server", Key: "port", Value: "3000"}}, "")))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestListCacheInvalidationEvents(t *testing.T) {
	list := func(t *testing.T, c *remoteSettingService, ns string) {
		t.Helper()
		_, err := c.List(request.WithNamespace(context.Background(), ns), metav1.LabelSelector{})
		require.NoError(t, err)
	}

	t.Run("event evicts only the affected namespace", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)
		assert.Equal(t, "us.watch.v1.setting.grafana.app.*.settings", sub.subject)

		for _, ns := range []string{"stacks-1", "stacks-2", "stacks-3"} {
			list(t, c, ns)
		}
		require.Equal(t, int32(3), requests.Load())

		sub.publish(t, "stacks-1")

		list(t, c, "stacks-2")
		list(t, c, "stacks-3")
		assert.Equal(t, int32(3), requests.Load(), "unaffected namespaces stay cached")
		list(t, c, "stacks-1")
		assert.Equal(t, int32(4), requests.Load(), "affected namespace is refetched")
		assert.Equal(t, float64(1), invalidations(c, invalidationReasonEvent))
		assert.Equal(t, float64(0), invalidations(c, invalidationReasonReconnect)+invalidations(c, invalidationReasonInvalidEvent))
		assert.Equal(t, float64(1), testutil.ToFloat64(c.metrics.cacheSubscribed))
	})

	namespaces := []string{"stacks-1", "stacks-2", "stacks-3"}

	// flushesAll warms every namespace, triggers the event, then expects all of them to be refetched.
	flushesAll := func(t *testing.T, reason string, trigger func(sub *fakeSubscriber)) {
		t.Helper()
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)

		for _, ns := range namespaces {
			list(t, c, ns)
		}
		require.Equal(t, int32(len(namespaces)), requests.Load(), "warm-up fetches each namespace once")
		for _, ns := range namespaces {
			list(t, c, ns)
		}
		require.Equal(t, int32(len(namespaces)), requests.Load(), "all namespaces are served from the cache")

		trigger(sub)

		for _, ns := range namespaces {
			list(t, c, ns)
		}
		assert.Equal(t, int32(2*len(namespaces)), requests.Load(), "every namespace is refetched")
		assert.Equal(t, float64(1), invalidations(c, reason))
		assert.Equal(t, float64(0), invalidations(c, invalidationReasonEvent), "not counted as a single-namespace event")
	}

	t.Run("all namespaces are flushed on reconnect", func(t *testing.T) {
		flushesAll(t, invalidationReasonReconnect, func(sub *fakeSubscriber) { sub.onReconnect() })
	})

	t.Run("all namespaces are flushed on an undecodable event", func(t *testing.T) {
		flushesAll(t, invalidationReasonInvalidEvent, func(sub *fakeSubscriber) { sub.handler(sub.subject, []byte("not a proto")) })
	})

	t.Run("all namespaces are flushed on an event without a namespace", func(t *testing.T) {
		flushesAll(t, invalidationReasonInvalidEvent, func(sub *fakeSubscriber) { sub.publish(t, "") })
	})

	t.Run("event during a fetch keeps the stale result out of the cache", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		inFetch := make(chan struct{})
		release := make(chan struct{})
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			if requests.Add(1) == 1 {
				close(inFetch)
				<-release
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(generateSettingsJSON(nil, "")))
		}))
		t.Cleanup(server.Close)
		c := newEventTestClient(t, server, sub, 0)

		done := make(chan struct{})
		go func() {
			defer close(done)
			list(t, c, "stacks-1")
		}()
		<-inFetch
		sub.publish(t, "stacks-1")
		close(release)
		<-done

		list(t, c, "stacks-1")
		assert.Equal(t, int32(2), requests.Load())
	})

	t.Run("subscribe failure falls back to TTL caching", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true, err: errors.New("nats down")}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)

		list(t, c, "stacks-1")
		list(t, c, "stacks-1")

		assert.Equal(t, int32(1), requests.Load())
		assert.Equal(t, float64(0), testutil.ToFloat64(c.metrics.cacheSubscribed))
	})

	t.Run("disabled subscriber is not used", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: false}
		c := newEventTestClient(t, countingServer(t, &requests), sub, 0)

		assert.Nil(t, sub.handler)
		list(t, c, "stacks-1")
		list(t, c, "stacks-1")
		assert.Equal(t, int32(1), requests.Load())
	})

	t.Run("caching disabled never subscribes", func(t *testing.T) {
		var requests atomic.Int32
		sub := &fakeSubscriber{enabled: true}
		newEventTestClient(t, countingServer(t, &requests), sub, -1)

		assert.Nil(t, sub.handler)
	})
}

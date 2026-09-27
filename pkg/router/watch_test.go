package router

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/sony/gobreaker/v2"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	watchGroup = "test-app"
	watchPath  = "/apis/" + watchGroup + "/v1/namespaces/stacks-1/things"

	addedEvent    = `{"type":"ADDED","object":{"kind":"Thing","metadata":{"name":"a","resourceVersion":"1"}}}`
	bookmarkEvent = `{"type":"BOOKMARK","object":{"kind":"Thing","metadata":{"resourceVersion":"1","annotations":{"k8s.io/initial-events-end":"true"}}}}`
	modifiedEvent = `{"type":"MODIFIED","object":{"kind":"Thing","metadata":{"name":"a","resourceVersion":"2"}}}`
)

// watchBackend serves Kubernetes-style watches: headers and an ADDED event at
// once (plus the initial-events-end bookmark for a watch-list), then each event
// sent on events, until timeoutSeconds passes, release is closed, or the
// request ends.
type watchBackend struct {
	queries chan url.Values
	events  chan string
	release chan struct{}
	gone    chan struct{} // receives when a watch's request ends before release
}

func newWatchBackend() *watchBackend {
	return &watchBackend{
		queries: make(chan url.Values, 16),
		events:  make(chan string),
		release: make(chan struct{}),
		gone:    make(chan struct{}, 16),
	}
}

func (b *watchBackend) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	query := req.URL.Query()
	b.queries <- query
	if requestVerb(req) != "watch" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	send := func(event string) {
		_, _ = io.WriteString(w, event+"\n")
		_ = http.NewResponseController(w).Flush()
	}
	send(addedEvent)
	if query.Get("sendInitialEvents") == "true" {
		send(bookmarkEvent)
	}
	var timeout <-chan time.Time
	if seconds, err := strconv.Atoi(query.Get("timeoutSeconds")); err == nil {
		timeout = time.After(time.Duration(seconds) * time.Second)
	}
	for {
		select {
		case event := <-b.events:
			send(event)
		case <-timeout:
			return
		case <-b.release:
			return
		case <-req.Context().Done():
			b.gone <- struct{}{}
			return
		}
	}
}

type watchRig struct {
	url     string
	backend *watchBackend
	service *Service
}

// newWatchRig serves watchGroup from one kind of backend, through the router in
// the given mode, on a real HTTP server.
func newWatchRig(t *testing.T, kind string, middleware bool) *watchRig {
	t.Helper()
	backend := newWatchBackend()
	var backends []Backend
	var fallback http.Handler
	if kind == "in-process" {
		backends = append(backends, &fakeBackend{group: metav1.APIGroup{Name: watchGroup}, key: "1", handler: backend})
	} else {
		upstream := httptest.NewServer(backend)
		t.Cleanup(upstream.Close)
		upstreamURL, err := url.Parse(upstream.URL)
		require.NoError(t, err)
		switch kind {
		case "forward":
			b, err := NewForwardBackend(metav1.APIGroup{Name: watchGroup}, forwardSpec(upstream.URL), "1", &http.Transport{})
			require.NoError(t, err)
			backends = append(backends, b)
		case "aggregate":
			b, err := newAggregateBackend("target", metav1.APIGroup{Name: watchGroup}, upstreamURL, &http.Transport{})
			require.NoError(t, err)
			backends = append(backends, b)
		case "single-tenant":
			st, err := newSingleTenantFallback(singleTenantFallbackOptions{
				cacheSize: 1,
				resolveHost: func(context.Context, int64) (singleTenantStack, error) {
					return singleTenantStack{URL: upstream.URL}, nil
				},
			})
			require.NoError(t, err)
			fallback = st
		default:
			t.Fatalf("unknown backend kind %q", kind)
		}
	}

	svc := newService(&mutableLoader{backends: backends}, prometheus.NewRegistry())
	svc.middleware = middleware
	svc.router.unregisteredGroupHandler = fallback
	require.NoError(t, svc.router.reconcile(t.Context()))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if middleware {
			req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{AccessToken: "access"}))
			svc.HandleFunc(w, req, http.NotFoundHandler())
			return
		}
		svc.metrics.instrument(svc.router, w, req, http.NotFoundHandler())
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() {
		select {
		case <-backend.release:
		default:
			close(backend.release)
		}
	})
	return &watchRig{url: server.URL, backend: backend, service: svc}
}

// openWatch starts a watch and returns a reader over its events.
func openWatch(ctx context.Context, t *testing.T, target string) *bufio.Reader {
	t.Helper()
	// A watch that should end but doesn't fails the test instead of hanging it.
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	t.Cleanup(cancel)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusOK, resp.StatusCode)
	return bufio.NewReader(resp.Body)
}

func requireEvent(t *testing.T, events *bufio.Reader, want string) {
	t.Helper()
	line, err := events.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, want, strings.TrimSuffix(line, "\n"))
}

// requireCleanEnd requires the stream to end with a complete response, not an
// aborted connection.
func requireCleanEnd(t *testing.T, events *bufio.Reader) {
	t.Helper()
	_, err := events.ReadString('\n')
	require.ErrorIs(t, err, io.EOF)
}

func TestWatchThroughEveryBackendAndMode(t *testing.T) {
	for _, kind := range []string{"forward", "aggregate", "single-tenant", "in-process"} {
		for _, middleware := range []bool{false, true} {
			mode := "standalone"
			if middleware {
				mode = "middleware"
			}
			t.Run(kind+"/"+mode, func(t *testing.T) {
				t.Parallel()
				for _, param := range []string{"watch=1", "watch=true"} {
					t.Run(param+" streams events as they happen", func(t *testing.T) {
						rig := newWatchRig(t, kind, middleware)
						events := openWatch(t.Context(), t, rig.url+watchPath+"?"+param)
						requireEvent(t, events, addedEvent)
						rig.backend.events <- modifiedEvent
						requireEvent(t, events, modifiedEvent)
						close(rig.backend.release)
						requireCleanEnd(t, events)
					})
				}

				t.Run("watch-list parameters and bookmark pass through", func(t *testing.T) {
					rig := newWatchRig(t, kind, middleware)
					events := openWatch(t.Context(), t, rig.url+watchPath+"?watch=true&sendInitialEvents=true&resourceVersionMatch=NotOlderThan&allowWatchBookmarks=true")
					requireEvent(t, events, addedEvent)
					requireEvent(t, events, bookmarkEvent)
					query := <-rig.backend.queries
					require.Equal(t, "true", query.Get("sendInitialEvents"))
					require.Equal(t, "NotOlderThan", query.Get("resourceVersionMatch"))
					require.Equal(t, "true", query.Get("allowWatchBookmarks"))
				})

				t.Run("the backend ends the stream at timeoutSeconds", func(t *testing.T) {
					rig := newWatchRig(t, kind, middleware)
					start := time.Now()
					events := openWatch(t.Context(), t, rig.url+watchPath+"?watch=true&timeoutSeconds=1")
					requireEvent(t, events, addedEvent)
					requireCleanEnd(t, events)
					require.GreaterOrEqual(t, time.Since(start), time.Second, "the router must not end the watch before the backend does")
				})

				t.Run("a client disconnect cancels the upstream watch", func(t *testing.T) {
					rig := newWatchRig(t, kind, middleware)
					ctx, cancel := context.WithCancel(t.Context())
					events := openWatch(ctx, t, rig.url+watchPath+"?watch=true")
					requireEvent(t, events, addedEvent)
					cancel()
					select {
					case <-rig.backend.gone:
					case <-time.After(5 * time.Second):
						t.Fatal("the upstream watch was not canceled")
					}
				})
			})
		}
	}
}

func TestWatchReleasesHalfOpenBreakerOnceItsStatusIsKnown(t *testing.T) {
	backend := newWatchBackend()
	cb := gobreaker.NewTwoStepCircuitBreaker[struct{}](gobreaker.Settings{
		Name:        watchGroup,
		Timeout:     10 * time.Millisecond,
		ReadyToTrip: func(counts gobreaker.Counts) bool { return counts.ConsecutiveFailures >= 1 },
	})
	router := withGroupHandlerAndBreaker(watchGroup, backend, cb)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		router.HandleFunc(w, req, http.NotFoundHandler())
	}))
	t.Cleanup(server.Close)
	t.Cleanup(func() { close(backend.release) })

	tripBreaker(cb)
	require.Eventually(t, func() bool { return cb.State() == gobreaker.StateHalfOpen }, time.Second, time.Millisecond)

	// The watch is the half-open trial. Once its 200 is written, the breaker
	// closes, although the watch is still streaming.
	events := openWatch(t.Context(), t, server.URL+watchPath+"?watch=true")
	requireEvent(t, events, addedEvent)
	require.Equal(t, gobreaker.StateClosed, cb.State())

	resp, err := http.Get(server.URL + watchPath)
	require.NoError(t, err)
	_ = resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode, "other requests must not wait for the watch to end")
}

func TestWatchMetricsAreSeparate(t *testing.T) {
	rig := newWatchRig(t, "in-process", false)
	metrics := rig.service.metrics

	events := openWatch(t.Context(), t, rig.url+watchPath+"?watch=true")
	requireEvent(t, events, addedEvent)
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.longRunning.WithLabelValues(watchGroup)))
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.inFlight))

	rig.backend.events <- modifiedEvent
	requireEvent(t, events, modifiedEvent)
	close(rig.backend.release)
	requireCleanEnd(t, events)
	require.Eventually(t, func() bool {
		return testutil.ToFloat64(metrics.longRunning.WithLabelValues(watchGroup)) == 0
	}, time.Second, time.Millisecond)
	require.Zero(t, testutil.CollectAndCount(metrics.duration), "a watch is not observed as a request duration")

	resp, err := http.Get(rig.url + watchPath)
	require.NoError(t, err)
	_ = resp.Body.Close()
	require.Equal(t, 1, testutil.CollectAndCount(metrics.duration))
	require.Equal(t, uint64(1), histogramCount(t, metrics.duration.WithLabelValues(watchGroup, "list", "204")))
}

func histogramCount(t *testing.T, observer prometheus.Observer) uint64 {
	t.Helper()
	metric, ok := observer.(prometheus.Metric)
	require.True(t, ok)
	var out dto.Metric
	require.NoError(t, metric.Write(&out))
	return out.GetHistogram().GetSampleCount()
}

func TestWatchEndsWhenItsBackendChanges(t *testing.T) {
	for _, kind := range []string{"forward", "in-process"} {
		t.Run(kind, func(t *testing.T) {
			rig := newWatchRig(t, kind, false)
			loader := rig.service.router.loader.(*mutableLoader)
			events := openWatch(t.Context(), t, rig.url+watchPath+"?watch=true")
			requireEvent(t, events, addedEvent)

			// An unchanged key keeps the watch.
			require.NoError(t, rig.service.router.reconcile(t.Context()))
			rig.backend.events <- modifiedEvent
			requireEvent(t, events, modifiedEvent)

			// A new key means a new backend: the watch ends so the client re-watches it.
			loader.backends = []Backend{&fakeBackend{group: metav1.APIGroup{Name: watchGroup}, key: "2", handler: rig.backend}}
			require.NoError(t, rig.service.router.reconcile(t.Context()))
			requireCleanEnd(t, events)

			events = openWatch(t.Context(), t, rig.url+watchPath+"?watch=true")
			requireEvent(t, events, addedEvent)
		})
	}
}

func TestWatchEndsWhenTheServiceStops(t *testing.T) {
	for _, kind := range []string{"forward", "single-tenant", "in-process"} {
		t.Run(kind, func(t *testing.T) {
			rig := newWatchRig(t, kind, false)
			events := openWatch(t.Context(), t, rig.url+watchPath+"?watch=true")
			requireEvent(t, events, addedEvent)
			require.NoError(t, rig.service.stopping(nil))
			requireCleanEnd(t, events)
		})
	}
}

func TestUpgradeRequestsAreRejected(t *testing.T) {
	for _, kind := range []string{"forward", "single-tenant", "in-process"} {
		t.Run(kind, func(t *testing.T) {
			rig := newWatchRig(t, kind, false)
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, rig.url+watchPath+"?watch=true", nil)
			require.NoError(t, err)
			req.Header.Set("Connection", "Upgrade")
			req.Header.Set("Upgrade", "websocket")
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			body, _ := io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			require.Equal(t, http.StatusBadRequest, resp.StatusCode)
			require.Contains(t, string(body), "watch over WebSocket is not supported")
			require.Empty(t, rig.backend.queries, "the backend must not be called")
		})
	}
}

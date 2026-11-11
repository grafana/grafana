package datasource

import (
	"crypto/sha256"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
	krequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestProxyTransportCacheConcurrentReuseAndInvalidation(t *testing.T) {
	cache := newProxyTransportCache()
	t.Cleanup(cache.close)
	var built, closed atomic.Int32
	build := func() (http.RoundTripper, func(), error) {
		built.Add(1)
		return &http.Transport{}, func() { closed.Add(1) }, nil
	}
	key := proxyTransportKey{"stack-1", "prometheus", "ds-1"}
	version := sha256.Sum256([]byte("config-1"))
	var wg sync.WaitGroup
	results := make(chan http.RoundTripper, 20)
	for range 20 {
		wg.Go(func() {
			rt, err := cache.get(key, version, build)
			if err != nil {
				t.Error(err)
				return
			}
			results <- rt
		})
	}
	wg.Wait()
	close(results)
	require.EqualValues(t, 1, built.Load())
	var first http.RoundTripper
	for rt := range results {
		if first == nil {
			first = rt
		}
		require.Same(t, first, rt)
	}
	_, err := cache.get(key, sha256.Sum256([]byte("rotated-secret")), build)
	require.NoError(t, err)
	require.EqualValues(t, 1, closed.Load())
	_, err = cache.get(proxyTransportKey{"stack-2", "prometheus", "ds-1"}, version, build)
	require.NoError(t, err)
	_, err = cache.get(proxyTransportKey{"stack-1", "prometheus", "ds-2"}, version, build)
	require.NoError(t, err)
	require.EqualValues(t, 4, built.Load())
	require.EqualValues(t, 1, closed.Load())
	cache.close()
	require.EqualValues(t, 4, closed.Load())
	_, err = cache.get(key, version, build)
	require.ErrorContains(t, err, "closed")
}

func TestProxyTransportCacheExpiresUnusedEntries(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cache := newProxyTransportCache()
		defer cache.close()
		closed := 0
		build := func() (http.RoundTripper, func(), error) {
			return &http.Transport{}, func() { closed++ }, nil
		}
		active := proxyTransportKey{"stack", "plugin", "active"}
		idle := proxyTransportKey{"stack", "plugin", "idle"}
		first, err := cache.get(active, [32]byte{}, build)
		require.NoError(t, err)
		_, err = cache.get(idle, [32]byte{}, build)
		require.NoError(t, err)

		time.Sleep(4 * time.Minute)
		reused, err := cache.get(active, [32]byte{}, build)
		require.NoError(t, err)
		require.Same(t, first, reused)
		time.Sleep(2 * time.Minute)
		synctest.Wait()
		require.Equal(t, 1, closed)
		require.Equal(t, 1, len(cache.entries))
		reused, err = cache.get(active, [32]byte{}, build)
		require.NoError(t, err)
		require.Same(t, first, reused)

		time.Sleep(6 * time.Minute)
		synctest.Wait()
		require.Equal(t, 2, closed)
		require.Zero(t, len(cache.entries))
		cache.close()
		synctest.Wait() // The cleanup goroutine must exit when storage is destroyed.
		require.Equal(t, 2, closed)
	})
}

func TestProxyTransportCacheExpiryAllowsActiveRequestToFinish(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	var unblock sync.Once
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		_, _ = io.WriteString(w, "pong")
	}))
	t.Cleanup(upstream.Close)
	t.Cleanup(func() { unblock.Do(func() { close(release) }) })
	cache := newProxyTransportCache()
	t.Cleanup(cache.close)
	var closed atomic.Int32
	build := func() (http.RoundTripper, func(), error) {
		transport := &http.Transport{}
		return transport, func() {
			closed.Add(1)
			transport.CloseIdleConnections()
		}, nil
	}
	first, err := cache.get(proxyTransportKey{}, [32]byte{}, build)
	require.NoError(t, err)
	finished := make(chan error, 1)
	go func() {
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, upstream.URL, nil)
		if err != nil {
			finished <- err
			return
		}
		resp, err := first.RoundTrip(req)
		if err == nil {
			_, err = io.Copy(io.Discard, resp.Body)
			err = errors.Join(err, resp.Body.Close())
		}
		finished <- err
	}()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("request did not reach upstream")
	}
	cache.mu.Lock()
	cache.entries[proxyTransportKey{}].lastUsed = time.Now().Add(-proxyTransportIdleTimeout)
	cache.mu.Unlock()
	cache.expire()
	next, err := cache.get(proxyTransportKey{}, [32]byte{}, build)
	require.NoError(t, err)
	require.NotSame(t, first, next)
	require.EqualValues(t, 1, closed.Load())
	unblock.Do(func() { close(release) })
	select {
	case err := <-finished:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("active request did not finish after cache expiry")
	}
}

func TestProxyTransportCacheExpiresOnLookupBeforeCleanup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cache := newProxyTransportCache()
		defer cache.close()
		closed := 0
		build := func() (http.RoundTripper, func(), error) {
			return &http.Transport{}, func() { closed++ }, nil
		}
		synctest.Wait()
		time.Sleep(30 * time.Second)
		first, err := cache.get(proxyTransportKey{}, [32]byte{}, build)
		require.NoError(t, err)
		time.Sleep(proxyTransportIdleTimeout)
		synctest.Wait()
		require.Zero(t, closed) // The next cleanup tick has not run yet.
		next, err := cache.get(proxyTransportKey{}, [32]byte{}, build)
		require.NoError(t, err)
		require.NotSame(t, first, next)
		require.Equal(t, 1, closed)
	})
}

func TestProxyTransportCacheConcurrentShutdown(t *testing.T) {
	cache := newProxyTransportCache()
	var built, closed atomic.Int32
	build := func() (http.RoundTripper, func(), error) {
		built.Add(1)
		return &http.Transport{}, func() { closed.Add(1) }, nil
	}
	_, err := cache.get(proxyTransportKey{}, [32]byte{}, build)
	require.NoError(t, err)
	var wg sync.WaitGroup
	for range 20 {
		wg.Go(func() {
			_, err := cache.get(proxyTransportKey{}, [32]byte{}, build)
			if err != nil {
				require.ErrorContains(t, err, "closed")
			}
			cache.expire()
			cache.close()
		})
	}
	wg.Wait()
	require.Equal(t, built.Load(), closed.Load())
	require.Empty(t, cache.entries)
	select {
	case <-cache.done:
	default:
		t.Fatal("cleanup goroutine still running after close")
	}
}

func TestProxyTransportCacheRetainsTransportAfterIdleConnectionCloses(t *testing.T) {
	closed := make(chan struct{}, 2)
	upstream := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "pong")
	}))
	upstream.Config.ConnState = func(_ net.Conn, state http.ConnState) {
		if state == http.StateClosed {
			closed <- struct{}{}
		}
	}
	upstream.Start()
	t.Cleanup(upstream.Close)
	cache := newProxyTransportCache()
	t.Cleanup(cache.close)
	built := 0
	build := func() (http.RoundTripper, func(), error) {
		built++
		transport := &http.Transport{IdleConnTimeout: 20 * time.Millisecond}
		return transport, transport.CloseIdleConnections, nil
	}
	var first http.RoundTripper
	for range 2 {
		rt, err := cache.get(proxyTransportKey{"stack", "plugin", "uid"}, [32]byte{}, build)
		require.NoError(t, err)
		if first == nil {
			first = rt
		}
		require.Same(t, first, rt)
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, upstream.URL, nil)
		require.NoError(t, err)
		resp, err := rt.RoundTrip(req)
		require.NoError(t, err)
		_, err = io.Copy(io.Discard, resp.Body)
		require.NoError(t, resp.Body.Close())
		require.NoError(t, err)
		select {
		case <-closed:
		case <-time.After(time.Second):
			t.Fatal("transport did not close its idle connection")
		}
	}
	require.Equal(t, 1, built)
}

func TestProxyTransportCacheDoesNotCacheErrors(t *testing.T) {
	cache := newProxyTransportCache()
	t.Cleanup(cache.close)
	for range 2 {
		_, err := cache.get(proxyTransportKey{}, [32]byte{}, func() (http.RoundTripper, func(), error) {
			return nil, func() {}, errors.New("bad certificate")
		})
		require.ErrorContains(t, err, "bad certificate")
	}
	require.Zero(t, len(cache.entries))
}

func TestProxyTransportFingerprint(t *testing.T) {
	settings := backend.DataSourceInstanceSettings{UID: "ds", JSONData: []byte(`{}`), DecryptedSecureJSONData: map[string]string{"password": "first"}}
	opts, err := settings.HTTPClientOptions(t.Context())
	require.NoError(t, err)
	initial, err := proxyTransportFingerprint(&settings, opts, "stack-config-1")
	require.NoError(t, err)
	settings.Updated = time.Now()
	same, err := proxyTransportFingerprint(&settings, opts, "stack-config-1")
	require.NoError(t, err)
	require.Equal(t, initial, same)
	changed, err := proxyTransportFingerprint(&settings, opts, "stack-config-2")
	require.NoError(t, err)
	require.NotEqual(t, initial, changed)
	settings.DecryptedSecureJSONData["password"] = "rotated"
	changed, err = proxyTransportFingerprint(&settings, opts, "stack-config-1")
	require.NoError(t, err)
	require.NotEqual(t, initial, changed)
	settings.DecryptedSecureJSONData["password"] = "first"
	opts.TLS = &sdkhttpclient.TLSOptions{ServerName: "new-server"}
	changed, err = proxyTransportFingerprint(&settings, opts, "stack-config-1")
	require.NoError(t, err)
	require.NotEqual(t, initial, changed)
}

func TestSubProxyREST_ReusesConnectionsWithCurrentUserHeaders(t *testing.T) {
	var connections atomic.Int32
	var closed atomic.Int32
	userHeaders := make(chan string, 1)
	upstream := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userHeaders <- r.Header.Get("X-Grafana-User")
		_, _ = io.WriteString(w, "pong")
	}))
	upstream.Config.ConnState = func(_ net.Conn, state http.ConnState) {
		if state == http.StateNew {
			connections.Add(1)
		}
		if state == http.StateClosed {
			closed.Add(1)
		}
	}
	upstream.Start()
	t.Cleanup(upstream.Close)
	ds := &datasourceV0.DataSource{}
	ds.Name = "ds-1"
	ds.Spec.SetURL(upstream.URL)
	provider := &proxyMockDatasourceProvider{ds: ds}
	provider.instanceSettings = &backend.DataSourceInstanceSettings{UID: "ds-1", Type: "test", URL: upstream.URL, JSONData: []byte(`{}`)}
	builder := newProxyTestBuilder(provider)
	deps, err := builder.proxyDependencies(t.Context(), nil)
	require.NoError(t, err)
	deps.OAuthTokenService = nil
	deps.ProxyCfg.SendUserHeader = true
	storage := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
	t.Cleanup(storage.Destroy)
	for _, tc := range []struct {
		namespace, login string
		config, secret   string
		conns            int32
	}{
		{"stacks-1", "alice", "config-1", "first", 1},
		{"stacks-1", "bob", "config-1", "first", 1},
		{"stacks-1", "alice-renamed", "config-1", "first", 1},
		{"stacks-1", "alice", "config-2", "first", 2},
		{"stacks-1", "alice", "config-2", "rotated", 3},
		{"stacks-2", "carol", "config-2", "rotated", 4},
	} {
		deps.TransportConfigKey = tc.config
		provider.instanceSettings.DecryptedSecureJSONData = map[string]string{"password": tc.secret}
		userID := int64(1)
		switch tc.login {
		case "bob":
			userID = 2
		case "carol":
			userID = 3
		}
		ctx := identity.WithRequester(krequest.WithNamespace(t.Context(), tc.namespace), &user.SignedInUser{UserID: userID, OrgID: 1, Login: tc.login})
		responder := &resourceMockResponder{}
		handler, err := storage.Connect(ctx, "ds-1", nil, responder)
		require.NoError(t, err)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequestWithContext(ctx, "GET", "/apis/test.datasource.grafana.app/v0alpha1/namespaces/"+tc.namespace+"/datasources/ds-1/proxy/query", nil))
		require.NoError(t, responder.lastErr)
		require.Equal(t, 200, rec.Code)
		require.Equal(t, "pong", rec.Body.String())
		require.Equal(t, tc.login, <-userHeaders)
		require.Equal(t, tc.conns, connections.Load())
	}
	storage.Destroy()
	require.Eventually(t, func() bool { return closed.Load() == connections.Load() }, time.Second, time.Millisecond)
}

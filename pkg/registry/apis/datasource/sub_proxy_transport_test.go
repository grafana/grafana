package datasource

import (
	"context"
	"crypto/sha256"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	krequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestProxyTransportCacheConcurrentReuseAndEviction(t *testing.T) {
	cache := newProxyTransportCache(2, time.Minute)
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
	require.EqualValues(t, 2, closed.Load())
	cache.close()
	require.EqualValues(t, 4, closed.Load())
	_, err = cache.get(key, version, build)
	require.ErrorContains(t, err, "closed")
}

func TestProxyTransportCacheExpiresWithoutAnotherRequest(t *testing.T) {
	cache := newProxyTransportCache(2, 20*time.Millisecond)
	t.Cleanup(cache.close)
	closed := make(chan struct{}, 1)
	_, err := cache.get(proxyTransportKey{"stack", "plugin", "uid"}, [32]byte{}, func() (http.RoundTripper, func(), error) {
		return &http.Transport{}, func() { closed <- struct{}{} }, nil
	})
	require.NoError(t, err)
	select {
	case <-closed:
	case <-time.After(time.Second):
		t.Fatal("unused transport was not evicted")
	}
}

func TestProxyTransportCacheDoesNotCacheErrors(t *testing.T) {
	cache := newProxyTransportCache(1, time.Minute)
	t.Cleanup(cache.close)
	for range 2 {
		_, err := cache.get(proxyTransportKey{}, [32]byte{}, func() (http.RoundTripper, func(), error) {
			return nil, func() {}, errors.New("bad certificate")
		})
		require.ErrorContains(t, err, "bad certificate")
	}
	require.Zero(t, cache.entries.Len())
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

func TestDatasourceLoaderTenantTimeouts(t *testing.T) {
	original := sdkhttpclient.DefaultTimeoutOptions
	for _, tc := range []struct {
		name, data string
		want       time.Duration
	}{
		{"tenant default", `{}`, 17 * time.Second},
		{"datasource override", `{"timeout":3}`, 3 * time.Second},
		{"explicit zero", `{"timeout":0}`, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var transport *http.Transport
			provider := httpclient.NewProvider(sdkhttpclient.ProviderOptions{ConfigureTransport: func(_ sdkhttpclient.Options, tr *http.Transport) { transport = tr }})
			defaults := sdkhttpclient.TimeoutOptions{Timeout: 17 * time.Second, DialTimeout: 8 * time.Second, IdleConnTimeout: 9 * time.Second, MaxConnsPerHost: 7}
			loader := &datasourceLoader{settings: &backend.DataSourceInstanceSettings{Type: "test", JSONData: []byte(tc.data)}, timeoutDefaults: &defaults}
			_, err := loader.GetHTTPTransport(t.Context(), provider)
			require.NoError(t, err)
			t.Cleanup(transport.CloseIdleConnections)
			require.Equal(t, tc.want, transport.ResponseHeaderTimeout)
			require.Equal(t, 9*time.Second, transport.IdleConnTimeout)
			require.Equal(t, 7, transport.MaxConnsPerHost)
			require.Equal(t, original, sdkhttpclient.DefaultTimeoutOptions)
		})
	}
}

type proxyTestUserTokens struct{}

func (proxyTestUserTokens) GetCurrentOAuthToken(_ context.Context, who identity.Requester, _ *usertoken.UserToken) *oauth2.Token {
	return &oauth2.Token{AccessToken: who.GetLogin(), TokenType: "Bearer"}
}

func TestSubProxyREST_ReusesConnectionsWithoutSharingUserCredentials(t *testing.T) {
	var connections atomic.Int32
	var closed atomic.Int32
	upstream := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, r.Header.Get("Authorization"))
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
	ds.Spec.SetJSONData(map[string]any{"oauthPassThru": true})
	provider := &proxyMockDatasourceProvider{ds: ds}
	provider.instanceSettings = &backend.DataSourceInstanceSettings{UID: "ds-1", Type: "test", URL: upstream.URL, JSONData: []byte(`{"oauthPassThru":true}`)}
	builder := newProxyTestBuilder(provider)
	builder.proxyDeps.OAuthTokenService = proxyTestUserTokens{}
	storage := &subProxyREST{builder: builder}
	t.Cleanup(storage.Destroy)
	for _, tc := range []struct {
		namespace, token string
		config, secret   string
		conns            int32
	}{
		{"stacks-1", "alice-token", "config-1", "first", 1},
		{"stacks-1", "bob-token", "config-1", "first", 1},
		{"stacks-1", "alice-refreshed-token", "config-1", "first", 1},
		{"stacks-1", "alice-token", "config-2", "first", 2},
		{"stacks-1", "alice-token", "config-2", "rotated", 3},
		{"stacks-2", "carol-token", "config-2", "rotated", 4},
	} {
		builder.proxyDeps.TransportConfigKey = tc.config
		provider.instanceSettings.DecryptedSecureJSONData = map[string]string{"password": tc.secret}
		userID := int64(1)
		if tc.token == "bob-token" {
			userID = 2
		} else if tc.token == "carol-token" {
			userID = 3
		}
		ctx := identity.WithRequester(krequest.WithNamespace(t.Context(), tc.namespace), &user.SignedInUser{UserID: userID, OrgID: 1, Login: tc.token})
		responder := &resourceMockResponder{}
		handler, err := storage.Connect(ctx, "ds-1", nil, responder)
		require.NoError(t, err)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequestWithContext(ctx, "GET", "/apis/test.datasource.grafana.app/v0alpha1/namespaces/"+tc.namespace+"/datasources/ds-1/proxy/query", nil))
		require.NoError(t, responder.lastErr)
		require.Equal(t, 200, rec.Code)
		require.Equal(t, "Bearer "+tc.token, rec.Body.String())
		require.Equal(t, tc.conns, connections.Load())
	}
	storage.Destroy()
	require.Eventually(t, func() bool { return closed.Load() == connections.Load() }, time.Second, time.Millisecond)
}

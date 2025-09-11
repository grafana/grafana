package live

import (
	"context"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"

	"github.com/centrifugal/centrifuge"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegration_provideLiveService_RedisUnavailable(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()

	cfg.LiveHAEngine = "testredisunavailable"

	_, err := setupLiveService(cfg, t)

	// Proceeds without live HA if redis is unavailable
	require.NoError(t, err)
}

func Test_runConcurrentlyIfNeeded_Concurrent(t *testing.T) {
	doneCh := make(chan struct{})
	f := func() {
		close(doneCh)
	}
	semaphore := make(chan struct{}, 2)
	err := runConcurrentlyIfNeeded(context.Background(), semaphore, f)
	require.NoError(t, err)

	select {
	case <-doneCh:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for function execution")
	}
}

func Test_runConcurrentlyIfNeeded_NoConcurrency(t *testing.T) {
	doneCh := make(chan struct{})
	f := func() {
		close(doneCh)
	}
	err := runConcurrentlyIfNeeded(context.Background(), nil, f)
	require.NoError(t, err)

	select {
	case <-doneCh:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for function execution")
	}
}

func Test_runConcurrentlyIfNeeded_DeadlineExceeded(t *testing.T) {
	f := func() {}
	semaphore := make(chan struct{}, 2)
	semaphore <- struct{}{}
	semaphore <- struct{}{}

	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	err := runConcurrentlyIfNeeded(ctx, semaphore, f)
	require.ErrorIs(t, err, context.DeadlineExceeded)
}

func TestCheckOrigin(t *testing.T) {
	testCases := []struct {
		name           string
		origin         string
		appURL         string
		allowedOrigins []string
		success        bool
		host           string
	}{
		{
			name:    "empty_origin",
			origin:  "",
			appURL:  "http://localhost:3000/",
			success: true,
		},
		{
			name:    "valid_origin",
			origin:  "http://localhost:3000",
			appURL:  "http://localhost:3000/",
			success: true,
		},
		{
			name:    "valid_origin_no_port",
			origin:  "https://www.example.com",
			appURL:  "https://www.example.com:443/grafana/",
			success: true,
		},
		{
			name:    "unauthorized_origin",
			origin:  "http://localhost:8000",
			appURL:  "http://localhost:3000/",
			success: false,
		},
		{
			name:    "bad_origin",
			origin:  ":::http://localhost:8000",
			appURL:  "http://localhost:3000/",
			success: false,
		},
		{
			name:    "different_scheme",
			origin:  "http://example.com",
			appURL:  "https://example.com",
			success: false,
		},
		{
			name:    "authorized_case_insensitive",
			origin:  "https://examplE.com",
			appURL:  "https://example.com",
			success: true,
		},
		{
			name:           "authorized_allowed_origins",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"https://test.example.com"},
			success:        true,
		},
		{
			name:           "authorized_allowed_origins_pattern",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"https://*.example.com"},
			success:        true,
		},
		{
			name:           "authorized_allowed_origins_all",
			origin:         "https://test.example.com",
			appURL:         "http://localhost:3000/",
			allowedOrigins: []string{"*"},
			success:        true,
		},
		{
			name:    "request_host_matches_origin_host",
			origin:  "http://example.com",
			appURL:  "https://example.com",
			success: true,
			host:    "example.com",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			appURL, err := url.Parse(tc.appURL)
			require.NoError(t, err)

			originGlobs, err := setting.GetAllowedOriginGlobs(tc.allowedOrigins)
			require.NoError(t, err)

			checkOrigin := getCheckOriginFunc(appURL, tc.allowedOrigins, originGlobs)

			r := httptest.NewRequest("GET", tc.appURL, nil)
			r.Host = tc.host
			r.Header.Set("Origin", tc.origin)
			require.Equal(t, tc.success, checkOrigin(r),
				"origin %s, appURL: %s", tc.origin, tc.appURL,
			)
		})
	}
}

func Test_getHistogramMetric(t *testing.T) {
	type args struct {
		val          int
		bounds       []int
		metricPrefix string
	}

	tests := []struct {
		name string
		args args
		want string
	}{
		{
			"zero",
			args{0, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_0",
		},
		{
			"equal_to_bound",
			args{10, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_10",
		},
		{
			"in_the_middle",
			args{30000, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_100000",
		},
		{
			"more_than_upper_bound",
			args{300000, []int{0, 10, 100, 1000, 10000, 100000}, "live_users_"},
			"live_users_le_inf",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getHistogramMetric(tt.args.val, tt.args.bounds, tt.args.metricPrefix); got != tt.want {
				t.Errorf("getHistogramMetric() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_handleOnPublish_IDTokenExpiration(t *testing.T) {
	g, err := setupLiveService(nil, t)
	require.NoError(t, err)

	client, _, err := centrifuge.NewClient(context.Background(), g.node, newDummyTransport("test"))
	require.NoError(t, err)

	t.Run("expired token", func(t *testing.T) {
		expiration := time.Now().Add(-time.Hour)
		token := createToken(t, &expiration)
		ctx := livecontext.SetContextSignedUser(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := g.handleOnPublish(ctx, client, centrifuge.PublishEvent{
			Channel: "test",
			Data:    []byte("test"),
		})
		require.ErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})

	t.Run("unexpired token", func(t *testing.T) {
		expiration := time.Now().Add(time.Hour)
		token := createToken(t, &expiration)
		ctx := livecontext.SetContextSignedUser(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := g.handleOnPublish(ctx, client, centrifuge.PublishEvent{
			Channel: "test",
			Data:    []byte("test"),
		})

		// Another error is returned if the token is not expired but the refresh fails.
		// That happens because we're providing an invalid orgID as the channel.
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})
}

func Test_handleOnRPC_IDTokenExpiration(t *testing.T) {
	g, err := setupLiveService(nil, t)
	require.NoError(t, err)

	client, _, err := centrifuge.NewClient(context.Background(), g.node, newDummyTransport("test"))
	require.NoError(t, err)

	t.Run("expired token", func(t *testing.T) {
		expiration := time.Now().Add(-time.Hour)
		token := createToken(t, &expiration)
		ctx := livecontext.SetContextSignedUser(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := g.handleOnRPC(ctx, client, centrifuge.RPCEvent{
			Method: "grafana.query",
			Data:   []byte("test"),
		})
		require.ErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})

	t.Run("unexpired token", func(t *testing.T) {
		expiration := time.Now().Add(time.Hour)
		token := createToken(t, &expiration)
		ctx := livecontext.SetContextSignedUser(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := g.handleOnRPC(ctx, client, centrifuge.RPCEvent{
			Method: "grafana.query",
			Data:   []byte("test"),
		})

		// Another error is returned if the token is not expired but the refresh fails.
		// That happens because we're providing an invalid orgID as the channel.
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})
}

func Test_handleOnSubscribe_IDTokenExpiration(t *testing.T) {
	g, err := setupLiveService(nil, t)
	require.NoError(t, err)

	client, _, err := centrifuge.NewClient(context.Background(), g.node, newDummyTransport("test"))
	require.NoError(t, err)

	t.Run("expired token", func(t *testing.T) {
		expiration := time.Now().Add(-time.Hour)
		token := createToken(t, &expiration)
		ctx := livecontext.SetContextSignedUser(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := g.handleOnSubscribe(ctx, client, centrifuge.SubscribeEvent{
			Channel: "test",
		})
		require.ErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})

	t.Run("unexpired token", func(t *testing.T) {
		expiration := time.Now().Add(time.Hour)
		token := createToken(t, &expiration)
		ctx := livecontext.SetContextSignedUser(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := g.handleOnSubscribe(ctx, client, centrifuge.SubscribeEvent{
			Channel: "test",
		})

		// Another error is returned if the token is not expired but the refresh fails.
		// That happens because we're providing an invalid orgID as the channel.
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})
}

func setupLiveService(cfg *setting.Cfg, t *testing.T) (*GrafanaLive, error) {
	if cfg == nil {
		cfg = setting.NewCfg()
	}

	return ProvideService(nil,
		cfg,
		routing.NewRouteRegister(),
		nil, nil, nil, nil,
		db.InitTestDB(t),
		nil,
		&usagestats.UsageStatsMock{T: t},
		nil,
		featuremgmt.WithFeatures(),
		acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		&dashboards.FakeDashboardService{},
		annotationstest.NewFakeAnnotationsRepo(),
		nil, nil)
}

type dummyTransport struct {
	name string
}

func (t *dummyTransport) Name() string                      { return t.name }
func (t *dummyTransport) Protocol() centrifuge.ProtocolType { return centrifuge.ProtocolTypeJSON }
func (t *dummyTransport) ProtocolVersion() centrifuge.ProtocolVersion {
	return centrifuge.ProtocolVersion2
}
func (t *dummyTransport) Emulation() bool           { return false }
func (t *dummyTransport) Unidirectional() bool      { return false }
func (t *dummyTransport) DisabledPushFlags() uint64 { return 0 }
func (t *dummyTransport) PingPongConfig() centrifuge.PingPongConfig {
	return centrifuge.PingPongConfig{}
}
func (t *dummyTransport) Write(data []byte) error     { return nil }
func (t *dummyTransport) WriteMany(d ...[]byte) error { return nil }
func (t *dummyTransport) Close(disconnect centrifuge.Disconnect) error {
	return nil
}

func newDummyTransport(name string) *dummyTransport {
	return &dummyTransport{name: name}
}

func createToken(t *testing.T, exp *time.Time) string {
	key := []byte("test-secret-key")
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: key}, nil)
	require.NoError(t, err)

	claims := struct {
		jwt.Claims
	}{
		Claims: jwt.Claims{
			Subject: "test-user",
		},
	}

	if exp != nil {
		claims.Expiry = jwt.NewNumericDate(*exp)
	}

	token, err := jwt.Signed(signer).Claims(claims).Serialize()
	require.NoError(t, err)
	return token
}

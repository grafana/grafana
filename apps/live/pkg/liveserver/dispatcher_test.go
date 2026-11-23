package liveserver

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"testing"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/live/pkg/model"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func newTestDispatcher(t *testing.T, opts Options) (*Dispatcher, *centrifuge.Node) {
	t.Helper()
	node, err := centrifuge.New(centrifuge.Config{})
	require.NoError(t, err)
	return NewDispatcher(node, opts), node
}

type recordingHandler struct {
	subscribed []string
	published  []string
}

func (h *recordingHandler) GetHandlerForPath(string) (model.ChannelHandler, error) { return h, nil }

func (h *recordingHandler) OnSubscribe(_ context.Context, _ identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	h.subscribed = append(h.subscribed, e.Channel)
	return model.SubscribeReply{Presence: true}, backend.SubscribeStreamStatusOK, nil
}

func (h *recordingHandler) OnPublish(_ context.Context, _ identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	h.published = append(h.published, e.Channel)
	return model.PublishReply{}, backend.PublishStreamStatusOK, nil
}

func TestDispatcherScopesHandlersByNamespace(t *testing.T) {
	handlers := map[string]*recordingHandler{
		"stacks-1": {},
		"stacks-2": {},
	}
	factoryCalls := map[string]int{}
	d, node := newTestDispatcher(t, Options{
		Scopes: map[string]ScopeHandler{
			live.ScopeDatasource: ScopeHandlerFunc(func(_ context.Context, user identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
				require.Equal(t, "same-uid", namespace)
				factoryCalls[user.GetNamespace()]++
				return handlers[user.GetNamespace()], nil
			}),
		},
	})
	client, closeClient, err := centrifuge.NewClient(context.Background(), node, newDummyTransport("test"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = closeClient() })

	const channel = "ds/same-uid/path"
	for _, namespace := range []string{"stacks-1", "stacks-2", "stacks-1", "stacks-2"} {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: authlib.TypeUser, UserUID: "u1", Namespace: namespace,
		})
		_, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{Channel: namespace + "/" + channel})
		require.NoError(t, err)
		_, err = d.OnPublish(ctx, client, centrifuge.PublishEvent{Channel: namespace + "/" + channel})
		require.NoError(t, err)
	}

	for namespace, handler := range handlers {
		require.Equal(t, []string{channel, channel}, handler.subscribed, namespace)
		require.Equal(t, []string{channel, channel}, handler.published, namespace)
		require.Equal(t, 1, factoryCalls[namespace], "reuse the handler within %s", namespace)
	}
}

func TestDispatcherSubscribe(t *testing.T) {
	dashboards := &recordingHandler{}
	d, node := newTestDispatcher(t, Options{
		Scopes: map[string]ScopeHandler{
			live.ScopeGrafana: Features{"dashboard": dashboards},
		},
	})
	client, _, err := centrifuge.NewClient(context.Background(), node, newDummyTransport("test"))
	require.NoError(t, err)
	ctx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "stacks-1"})

	t.Run("own namespace", func(t *testing.T) {
		reply, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{Channel: "stacks-1/grafana/dashboard/uid/abc"})
		require.NoError(t, err)
		require.True(t, reply.Options.EmitPresence)
		require.Equal(t, []string{"grafana/dashboard/uid/abc"}, dashboards.subscribed)
	})

	t.Run("other namespace is denied", func(t *testing.T) {
		_, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{Channel: "stacks-2/grafana/dashboard/uid/abc"})
		require.ErrorIs(t, err, centrifuge.ErrorPermissionDenied)
		_, err = d.OnPublish(ctx, client, centrifuge.PublishEvent{Channel: "stacks-2/grafana/dashboard/uid/abc"})
		require.ErrorIs(t, err, centrifuge.ErrorPermissionDenied)
	})

	t.Run("scope without a handler is not available", func(t *testing.T) {
		_, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{Channel: "stacks-1/ds/some-uid/path"})
		require.ErrorIs(t, err, centrifuge.ErrorNotAvailable)
	})

	t.Run("unknown feature", func(t *testing.T) {
		_, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{Channel: "stacks-1/grafana/unknown/path"})
		require.ErrorIs(t, err, centrifuge.ErrorInternal)
	})

	t.Run("invalid scope", func(t *testing.T) {
		_, err := d.GetChannelHandlerFactory(ctx, nil, "nope", "x")
		require.ErrorContains(t, err, "invalid scope")
		require.NotErrorIs(t, err, ErrScopeNotAvailable)
	})
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

func Test_handleOnPublish_IDTokenExpiration(t *testing.T) {
	d, node := newTestDispatcher(t, Options{})

	client, _, err := centrifuge.NewClient(context.Background(), node, newDummyTransport("test"))
	require.NoError(t, err)

	t.Run("expired token", func(t *testing.T) {
		// When the token is expired we trigger a refresh. If the refresh
		// trigger succeeds we let the op proceed instead of failing with
		// ErrorExpired (which centrifuge-js treats as fatal and would tear
		// down the subscription with no retry).
		expiration := time.Now().Add(-time.Hour)
		token := createToken(t, &expiration)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := d.OnPublish(ctx, client, centrifuge.PublishEvent{
			Channel: "test",
			Data:    []byte("test"),
		})
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.NotErrorIs(t, err, errorExpiredTemporary)
		require.Empty(t, reply)
	})

	t.Run("unexpired token", func(t *testing.T) {
		expiration := time.Now().Add(time.Hour)
		token := createToken(t, &expiration)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := d.OnPublish(ctx, client, centrifuge.PublishEvent{
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
	d, node := newTestDispatcher(t, Options{})

	client, _, err := centrifuge.NewClient(context.Background(), node, newDummyTransport("test"))
	require.NoError(t, err)

	t.Run("expired token", func(t *testing.T) {
		// See the matching note in Test_handleOnPublish_IDTokenExpiration —
		// successful refresh trigger should let the op continue rather than
		// returning ErrorExpired.
		expiration := time.Now().Add(-time.Hour)
		token := createToken(t, &expiration)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := d.OnRPC(ctx, client, centrifuge.RPCEvent{
			Method: "grafana.query",
			Data:   []byte("test"),
		})
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.NotErrorIs(t, err, errorExpiredTemporary)
		require.Empty(t, reply)
	})

	t.Run("unexpired token", func(t *testing.T) {
		expiration := time.Now().Add(time.Hour)
		token := createToken(t, &expiration)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := d.OnRPC(ctx, client, centrifuge.RPCEvent{
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
	d, node := newTestDispatcher(t, Options{})

	client, _, err := centrifuge.NewClient(context.Background(), node, newDummyTransport("test"))
	require.NoError(t, err)

	t.Run("expired token", func(t *testing.T) {
		// See the matching note in Test_handleOnPublish_IDTokenExpiration.
		expiration := time.Now().Add(-time.Hour)
		token := createToken(t, &expiration)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{
			Channel: "test",
		})
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.NotErrorIs(t, err, errorExpiredTemporary)
		require.Empty(t, reply)
	})

	t.Run("unexpired token", func(t *testing.T) {
		expiration := time.Now().Add(time.Hour)
		token := createToken(t, &expiration)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{IDToken: token})
		reply, err := d.OnSubscribe(ctx, client, centrifuge.SubscribeEvent{
			Channel: "test",
		})

		// Another error is returned if the token is not expired but the refresh fails.
		// That happens because we're providing an invalid orgID as the channel.
		require.NotErrorIs(t, err, centrifuge.ErrorExpired)
		require.Empty(t, reply)
	})
}

type dummyTransport struct {
	name string
}

var (
	_ centrifuge.Transport = (*dummyTransport)(nil)
)

func (t *dummyTransport) Name() string                      { return t.name }
func (t *dummyTransport) AcceptProtocol() string            { return "" }
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

// There is a duplication of this function in the identity package. pkg/apimachinery/identity/requester_test.go.
// If you need to copy it, place it as a test helper function in the identity package.
var testKey = decodePrivateKey([]byte(
	"-----BEGIN EC PRIVATE KEY-----\n" + // trufflehog:ignore
		"MHcCAQEEID6lXWsmcv/UWn9SptjOThsy88cifgGIBj2Lu0M9I8tQoAoGCCqGSM49\n" + // trufflehog:ignore
		"AwEHoUQDQgAEsf6eNnNMNhl+q7jXsbdUf3ADPh248uoFUSSV9oBzgptyokHCjJz6\n" + // trufflehog:ignore
		"n6PKDm2W7i3S2+dAs5M5f3s7d8KiLjGZdQ==\n" + // trufflehog:ignore
		"-----END EC PRIVATE KEY-----", // trufflehog:ignore
))

func decodePrivateKey(data []byte) *ecdsa.PrivateKey {
	block, _ := pem.Decode(data)
	if block == nil {
		panic("should include PEM block")
	}

	privateKey, err := x509.ParseECPrivateKey(block.Bytes)
	if err != nil {
		panic(fmt.Sprintf("should be able to parse ec private key: %v", err))
	}
	if privateKey.Curve.Params().Name != "P-256" {
		panic("should be valid private key")
	}

	return privateKey
}

func createToken(t *testing.T, exp *time.Time) string {
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: testKey}, nil)
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

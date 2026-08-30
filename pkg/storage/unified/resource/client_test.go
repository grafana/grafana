package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIDTokenExtractor(t *testing.T) {
	t.Run("should return an error when no claims found", func(t *testing.T) {
		token, err := IDTokenExtractor(context.Background())
		assert.Error(t, err)
		assert.Empty(t, token)
	})
	t.Run("should return an empty token when grafana identity is set", func(t *testing.T) {
		ctx, _ := identity.WithServiceIdentity(context.Background(), 0)
		token, err := IDTokenExtractor(ctx)
		assert.NoError(t, err)
		assert.Empty(t, token)
	})
}

func TestNewAuthnGrpcClientInterceptor(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("")

	t.Run("empty token exchange url in dev falls back to the in-proc exchanger", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace: "*",
			Audiences: []string{"resourceStore"},
			IsDev:     true,
		})
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})

	t.Run("empty token exchange url outside dev is a misconfiguration", func(t *testing.T) {
		_, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace: "*",
			Audiences: []string{"resourceStore"},
			IsDev:     false,
		})
		require.Error(t, err, "must not silently self-mint tokens outside dev mode")
	})

	t.Run("an explicit TokenExchanger is used regardless of dev mode", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Namespace:      "*",
			Audiences:      []string{"resourceStore"},
			IsDev:          false,
			TokenExchanger: ProvideInProcExchanger(),
		})
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})

	t.Run("a token exchange url builds a real exchange client outside dev", func(t *testing.T) {
		interceptor, err := NewAuthnGrpcClientInterceptor(tracer, RemoteResourceClientConfig{
			Token:            "some-token",
			TokenExchangeURL: "https://example.com/token",
			Namespace:        "*",
			Audiences:        []string{"resourceStore"},
			IsDev:            false,
		})
		require.NoError(t, err)
		require.NotNil(t, interceptor)
	})
}

package tracectx

import (
	"context"
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func TestHexEncodeTraceFromContext(t *testing.T) {
	t.Run("when no trace is present in context, it returns empty string", func(t *testing.T) {
		ctx := context.Background()

		encoded := HexEncodeTraceFromContext(ctx)
		require.Empty(t, encoded)
	})

	t.Run("when trace is present in context, it returns hex-encoded string", func(t *testing.T) {
		carrier := propagation.MapCarrier{
			"traceparent": "00-446e31681d64f9dcefd947c95ef321d0-009e2f3d8ded1892-01",
			"tracestate":  "first=abc1234,second=xyz7890",
		}
		ctx := propagation.TraceContext{}.Extract(context.Background(), carrier)

		encoded := HexEncodeTraceFromContext(ctx)
		require.NotEmpty(t, encoded)

		traceCtx, err := HexDecodeTraceIntoContext(context.Background(), encoded)
		require.NoError(t, err)

		span := trace.SpanFromContext(traceCtx)
		require.True(t, span.SpanContext().IsValid())

		carrier = propagation.MapCarrier(make(map[string]string))
		propagation.TraceContext{}.Inject(traceCtx, carrier)
		require.Contains(t, carrier, "traceparent")
		require.Contains(t, carrier, "tracestate")
	})
}

func TestHexDecodeTraceIntoContext(t *testing.T) {
	t.Run("when encoded string is empty, it returns original context", func(t *testing.T) {
		ctx := context.Background()

		result, err := HexDecodeTraceIntoContext(ctx, "")
		require.NoError(t, err)
		require.Equal(t, ctx, result)
	})

	t.Run("when encoded string is valid hex, it returns context with trace", func(t *testing.T) {
		encoded := hex.EncodeToString([]byte("traceparent=00-446e31681d64f9dcefd947c95ef321d0-009e2f3d8ded1892-01#tracestate=first=abc1234,second=xyz7890"))

		ctx, err := HexDecodeTraceIntoContext(context.Background(), encoded)
		require.NoError(t, err)

		span := trace.SpanFromContext(ctx)
		require.True(t, span.SpanContext().IsValid())
	})

	t.Run("when encoded string has invalid hex encoding, it returns an error", func(t *testing.T) {
		invalidHex := "invalid-hex-zzz"

		result, err := HexDecodeTraceIntoContext(context.Background(), invalidHex)
		require.Error(t, err)
		require.Nil(t, result)
	})

	t.Run("when decoded string has invalid key-value pair format, it returns an error", func(t *testing.T) {
		// missing key
		encoded := hex.EncodeToString([]byte("00-446e31681d64f9dcefd947c95ef321d0-009e2f3d8ded1892-01"))

		result, err := HexDecodeTraceIntoContext(context.Background(), encoded)
		require.Error(t, err)
		require.Nil(t, result)
	})

	t.Run("when decoded string has key without value, it returns error", func(t *testing.T) {
		// missing value
		encoded := hex.EncodeToString([]byte("traceparent="))

		result, err := HexDecodeTraceIntoContext(context.Background(), encoded)
		require.Error(t, err)
		require.Nil(t, result)
	})
}

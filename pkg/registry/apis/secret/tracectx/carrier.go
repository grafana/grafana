package tracectx

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/propagation"
)

const (
	kvSeparator   = "="
	pairSeparator = "#"
)

func HexEncodeTraceFromContext(ctx context.Context) string {
	carrier := propagation.MapCarrier(make(map[string]string))

	propagation.TraceContext{}.Inject(ctx, carrier)

	// no trace in context
	if len(carrier) == 0 {
		return ""
	}

	pairs := make([]string, 0, len(carrier))
	for k, v := range carrier {
		pairs = append(pairs, k+kvSeparator+v)
	}

	return hex.EncodeToString([]byte(strings.Join(pairs, pairSeparator)))
}

func HexDecodeTraceIntoContext(ctx context.Context, encoded string) (context.Context, error) {
	if encoded == "" {
		return ctx, nil
	}

	decoded, err := hex.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	pairs := strings.Split(string(decoded), pairSeparator)

	carrier := make(propagation.MapCarrier, len(pairs))
	for _, pair := range pairs {
		kv := strings.SplitN(pair, kvSeparator, 2)
		if len(kv) != 2 || kv[0] == "" || kv[1] == "" {
			return nil, fmt.Errorf("invalid key-value pair: %s", pair)
		}
		carrier[kv[0]] = kv[1]
	}

	return propagation.TraceContext{}.Extract(ctx, carrier), nil
}

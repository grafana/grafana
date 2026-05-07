package stream_utils

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/config"
)

const (
	TeamHttpHeaderKeyLower = "x-prom-label-policy"
	TeamHttpHeaderKeyCamel = "X-Prom-Label-Policy"
)

// returns HTTP header key/value pairs for the outgoing Tempo streaming gRPC call.
// It always includes datasource HTTP client option headers. When streamingForwardTeamHeadersTempo is enabled, it also merges
// outgoing gRPC metadata: X-Prom-Label-Policy is set from the x-prom-label-policy metadata values, and every other
// metadata entry is copied under its existing key.
func GetHeadersFromIncomingContext(ctx context.Context, logger log.Logger) (map[string]string, error) {
	plugin := backend.PluginConfigFromContext(ctx)
	headers, err := getClientOptionsHeaders(ctx, plugin)
	if err != nil {
		return nil, err
	}

	// fetch team headers from outgoing context.
	teamHeaders := getTeamHeaders(ctx, logger, plugin)
	for k, v := range teamHeaders {
		headers[k] = v
	}
	return headers, nil
}

// maps outgoing gRPC metadata to HTTP-style header strings (comma-joined values per key).
// x-prom-label-policy is exposed as X-Prom-Label-Policy.
func getTeamHeaders(ctx context.Context, logger log.Logger, plugin backend.PluginContext) map[string]string {
	cfg := config.GrafanaConfigFromContext(ctx)
	if cfg == nil || !cfg.FeatureToggles().IsEnabled("streamingForwardTeamHeadersTempo") {
		return nil
	}

	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		// if no metadata was found in the outgoing context, try to get it from incoming context
		md, ok = metadata.FromIncomingContext(ctx)
		if !ok {
			if plugin.DataSourceInstanceSettings != nil {
				logger.Debug("No outgoing gRPC metadata for team header forwarding", "datasource_uid", plugin.DataSourceInstanceSettings.UID)
			}
			return nil
		}
	}

	headers := map[string]string{}
	for headerKey, headerVals := range md {
		joined := strings.Join(headerVals, ",")
		if headerKey == TeamHttpHeaderKeyLower {
			headers[TeamHttpHeaderKeyCamel] = joined
			continue
		}
		headers[headerKey] = joined
	}
	return headers
}

func getClientOptionsHeaders(ctx context.Context, plugin backend.PluginContext) (map[string]string, error) {
	headers := map[string]string{}
	opts, err := plugin.DataSourceInstanceSettings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get HTTP client options: %w", err)
	}

	for name, values := range opts.Header {
		joined := strings.Join(values, ",")
		headers[name] = joined
	}
	return headers, nil
}

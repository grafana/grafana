package stream_utils

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"google.golang.org/grpc/metadata"
)

const (
	TeamHttpHeaderKeyLower = "x-prom-label-policy"
	TeamHttpHeaderKeyCamel = "X-Prom-Label-Policy"
)

// SetHeadersFromIncomingContext returns HTTP header key/value pairs for the outgoing Tempo streaming gRPC call.
// It always includes datasource HTTP client option headers. When forwardTeamHeadersTempo is enabled, it also merges
// outgoing gRPC metadata: X-Prom-Label-Policy is set from the x-prom-label-policy metadata values, and every other
// metadata entry is copied under its existing key.
func SetHeadersFromIncomingContext(ctx context.Context, logger log.Logger) (map[string]string, error) {
	plugin := backend.PluginConfigFromContext(ctx)
	headers, err := getClientOptionsHeaders(ctx, plugin)
	if err != nil {
		return nil, err
	}

	cfg := backend.GrafanaConfigFromContext(ctx)
	if cfg == nil || !cfg.FeatureToggles().IsEnabled(featuremgmt.FlagForwardTeamHeadersTempo) {
		return headers, nil
	}

	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		if plugin.DataSourceInstanceSettings != nil {
			logger.Debug("No outgoing gRPC metadata for team header forwarding", "datasource_uid", plugin.DataSourceInstanceSettings.UID)
		}
		return headers, nil
	}

	for k, vals := range md {
		if len(vals) == 0 {
			continue
		}
		joined := strings.Join(vals, ",")
		if k == TeamHttpHeaderKeyLower {
			headers[TeamHttpHeaderKeyCamel] = joined
			continue
		}
		headers[k] = joined
	}
	return headers, nil
}

func getClientOptionsHeaders(ctx context.Context, plugin backend.PluginContext) (map[string]string, error) {
	headers := map[string]string{}
	opts, err := plugin.DataSourceInstanceSettings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get HTTP client options: %w", err)
	}

	for name, values := range opts.Header {
		for _, value := range values {
			headers[name] = value
		}
	}
	return headers, nil
}

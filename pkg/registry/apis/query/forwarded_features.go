package query

import (
	"context"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/queryheaders"
)

// mergeForwardedFeatureTogglesHeader adds X-Grafana-Forwarded-Feature-Toggles when the query API has
// resolved stack/instance toggles. Downstream Grafana merges these into PluginRequestConfig so core
// datasources (e.g. Loki Grafana SQL) see the same flags as expression evaluation without inferring
// from query payload shape.
func mergeForwardedFeatureTogglesHeader(headers map[string]string, toggles featuremgmt.FeatureToggles, ctx context.Context) map[string]string {
	if toggles == nil {
		return headers
	}
	enabled := toggles.GetEnabled(ctx)
	if len(enabled) == 0 {
		return headers
	}
	names := make([]string, 0, len(enabled))
	for name := range enabled {
		names = append(names, name)
	}
	slices.Sort(names)
	out := make(map[string]string, len(headers)+1)
	for k, v := range headers {
		out[k] = v
	}
	out[queryheaders.ForwardedFeatureToggles] = strings.Join(names, ",")
	return out
}

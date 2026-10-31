package featuremgmt

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
)

// RoutePreferencesAndCollections reports whether the router serves
// collections.grafana.app and preferences.grafana.app, in place of the embedded
// API server. It is evaluated through OpenFeature, so a remote provider can turn
// it on without a [feature_toggles] entry, and is read once, at startup.
func RoutePreferencesAndCollections() bool {
	ctx := context.Background()
	return openfeature.NewDefaultClient().Boolean(ctx, FlagGrafanaRoutePreferencesAndCollections, false, openfeature.TransactionContext(ctx))
}

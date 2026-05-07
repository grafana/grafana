package queryheaders

import "context"

type forwardedFeaturesCtxKey struct{}

// WithForwardedFeatureNames attaches a comma-separated list of feature names from the query-service
// forwarding header so PluginRequestConfig can merge them without importing HTTP stacks.
func WithForwardedFeatureNames(ctx context.Context, csv string) context.Context {
	if csv == "" {
		return ctx
	}
	return context.WithValue(ctx, forwardedFeaturesCtxKey{}, csv)
}

// ForwardedFeatureNamesCSV returns the forwarded feature list previously attached with WithForwardedFeatureNames.
func ForwardedFeatureNamesCSV(ctx context.Context) string {
	v, _ := ctx.Value(forwardedFeaturesCtxKey{}).(string)
	return v
}

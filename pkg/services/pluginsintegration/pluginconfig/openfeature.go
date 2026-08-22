package pluginconfig

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

// OpenFeature provider discovery config keys, shared between the startup
// environment variables and the per-request config map so plugins can resolve
// them uniformly on both channels. They mirror the constants exposed by the
// grafana-plugin-sdk-go config package and are redeclared here until the SDK
// version pinned by go.mod includes them.
const (
	openFeatureProviderURLKey  = "GF_INSTANCE_OPENFEATURE_PROVIDER_URL"
	openFeatureProviderTypeKey = "GF_INSTANCE_OPENFEATURE_PROVIDER_TYPE"
	openFeatureCacheTTLKey     = "GF_INSTANCE_OPENFEATURE_CACHE_TTL"
	openFeatureContextKey      = "GF_INSTANCE_OPENFEATURE_CONTEXT"
)

// openFeatureProviderURL resolves the OFREP base URL plugins should evaluate
// feature flags against. Remote providers (features-service, ofrep) expose
// their own URL; without one there is nothing plugins could reach, so
// discovery is not advertised at all. The static provider serves the
// [feature_toggles] ini flags on Grafana's own root OFREP route
// (/ofrep/v1/evaluate/flags), so the Grafana app URL is advertised instead.
func (cfg *PluginInstanceCfg) openFeatureProviderURL() string {
	of := cfg.OpenFeature
	if of.ProviderType == setting.FeaturesServiceProviderType || of.ProviderType == setting.OFREPProviderType {
		if of.URL == nil {
			return ""
		}
		return of.URL.String()
	}
	return cfg.GrafanaAppURL
}

// openFeatureCacheTTLSeconds returns the advisory evaluation cache TTL as an
// integer number of seconds, so plugins in any language can parse it. On the
// wire 0 means "no caching advice", so negative TTLs are clamped to 0 and
// sub-second TTLs are rounded up to 1 rather than silently becoming 0.
func (cfg *PluginInstanceCfg) openFeatureCacheTTLSeconds() string {
	ttl := cfg.OpenFeature.CacheTTL
	if ttl <= 0 {
		return "0"
	}
	secs := int64(ttl / time.Second)
	if secs == 0 {
		secs = 1
	}
	return strconv.FormatInt(secs, 10)
}

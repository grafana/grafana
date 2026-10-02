package pluginconfig

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

// OpenFeature provider discovery keys for the per-request config map. They
// mirror the constants exposed by the grafana-plugin-sdk-go config package
// and are redeclared here until the SDK version pinned by go.mod includes
// them.
const (
	openFeatureProviderURLKey  = "GF_INSTANCE_OPENFEATURE_PROVIDER_URL"
	openFeatureProviderTypeKey = "GF_INSTANCE_OPENFEATURE_PROVIDER_TYPE"
	openFeatureCacheTTLKey     = "GF_INSTANCE_OPENFEATURE_CACHE_TTL"
	openFeatureContextKey      = "GF_INSTANCE_OPENFEATURE_CONTEXT"
)

// openFeatureDiscovery returns the endpoint and type advertised to plugins: PluginURL, then the provider URL, or empty strings for nothing.
// The app URL is advertised only for static, because only then does Grafana's own OFREP route serve all flags without credentials.
func (cfg *PluginInstanceCfg) openFeatureDiscovery() (providerURL string, providerType string) {
	of := cfg.OpenFeature
	switch {
	case of.PluginURL != nil:
		return of.PluginURL.String(), string(setting.OFREPProviderType)
	case of.ProviderType == setting.StaticProviderType && cfg.GrafanaAppURL != "":
		return cfg.GrafanaAppURL, string(setting.StaticProviderType)
	case (of.ProviderType == setting.OFREPProviderType || of.ProviderType == setting.FeaturesServiceProviderType) && of.URL != nil:
		return of.URL.String(), string(of.ProviderType)
	default:
		return "", ""
	}
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

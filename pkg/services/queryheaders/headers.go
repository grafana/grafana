// Package queryheaders holds HTTP header names shared between the query API and plugin request configuration.
package queryheaders

// ForwardedFeatureToggles is set by query.grafana.app when dispatching to backend Grafana so stack/instance
// feature toggles are merged into PluginRequestConfig (see pluginsintegration/pluginconfig).
const ForwardedFeatureToggles = "X-Grafana-Forwarded-Feature-Toggles"

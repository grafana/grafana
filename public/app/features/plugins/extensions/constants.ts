// The plugin ID under which extensions provided by core Grafana — or code compiled into the core
// bundle, e.g. Grafana Enterprise frontend — are registered. It is not a real app plugin:
// registrations under this ID skip plugin meta validation and render without a plugin context.
export const GRAFANA_CORE_PLUGIN_ID = 'grafana';

// App plugin ids the homepage recommends and links into.
export const SYNTHETIC_MONITORING_APP_ID = 'grafana-synthetic-monitoring-app';
/** RBAC action the SM app's plugin.json grants Editors/Admins for check creation. */
export const SYNTHETIC_MONITORING_CHECKS_WRITE = `${SYNTHETIC_MONITORING_APP_ID}.checks:write`;
export const APP_OBSERVABILITY_APP_ID = 'grafana-app-observability-app';
export const HOSTED_TRACES_APP_ID = 'grafana-exploretraces-app';
export const LOGS_DRILLDOWN_APP_ID = 'grafana-lokiexplore-app';
export const METRICS_DRILLDOWN_APP_ID = 'grafana-metricsdrilldown-app';

// App plugin ids the homepage recommends and links into.
export const SYNTHETIC_MONITORING_APP_ID = 'grafana-synthetic-monitoring-app';
/** RBAC action the SM app's plugin.json grants Editors/Admins for check creation. */
export const SYNTHETIC_MONITORING_CHECKS_WRITE = `${SYNTHETIC_MONITORING_APP_ID}.checks:write`;
/** Check-creation entry; setup also needs SYNTHETIC_MONITORING_CHECKS_WRITE. */
export const SYNTHETIC_MONITORING_SETUP_PATH = '/checks/choose-type';
export const APP_OBSERVABILITY_APP_ID = 'grafana-app-observability-app';
/** Onboarding page. It only explains external instrumentation, so page access is the whole permission check. */
export const APP_OBSERVABILITY_SETUP_PATH = '/landing';
export const HOSTED_TRACES_APP_ID = 'grafana-exploretraces-app';
export const LOGS_DRILLDOWN_APP_ID = 'grafana-lokiexplore-app';
export const METRICS_DRILLDOWN_APP_ID = 'grafana-metricsdrilldown-app';

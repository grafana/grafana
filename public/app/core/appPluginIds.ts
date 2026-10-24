// Ids of the app plugins that core and feature code refers to by name, in one
// place because several are referenced from more than one of them (nav
// placement, the homepage recommendations).
export const ADAPTIVE_TELEMETRY_UMBRELLA_APP_ID = 'grafana-adaptivetelemetry-app';
export const APP_OBSERVABILITY_APP_ID = 'grafana-app-observability-app';
export const ASSERTS_APP_ID = 'grafana-asserts-app';
export const ASSISTANT_APP_ID = 'grafana-assistant-app';
export const ASSISTANT_ONBOARDING_APP_ID = 'grafana-assistant-onboarding-app';
export const COLLECTOR_APP_ID = 'grafana-collector-app';
export const DBCFG_APP_ID = 'grafana-dbcfg-app';
export const AUTH_APP_ID = 'grafana-auth-app';
export const DOCS_PLUGIN_APP_ID = 'grafana-grafanadocsplugin-app';
export const HOSTED_TRACES_APP_ID = 'grafana-exploretraces-app';
export const LOGS_DRILLDOWN_APP_ID = 'grafana-lokiexplore-app';
export const MAINTENANCE_WINDOWS_APP_ID = 'grafana-maintenancewindows-app';
export const METRICS_DRILLDOWN_APP_ID = 'grafana-metricsdrilldown-app';
export const PATHFINDER_APP_ID = 'grafana-pathfinder-app';
export const PDC_APP_ID = 'grafana-pdc-app';
export const SERVICECENTER_APP_ID = 'grafana-servicecenter-app';
export const SLO_APP_ID = 'grafana-slo-app';
export const SYNTHETIC_MONITORING_APP_ID = 'grafana-synthetic-monitoring-app';

/** RBAC action the SM app's plugin.json grants Editors/Admins for check creation. */
export const SYNTHETIC_MONITORING_CHECKS_WRITE = `${SYNTHETIC_MONITORING_APP_ID}.checks:write`;

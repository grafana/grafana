// The ID of the app plugin that we render under that "Cloud Integrations" tab
export const CLOUD_ONBOARDING_APP_ID = 'grafana-easystart-app';

// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'connections';

export const ROUTES = {
  DataSources: `/${ROUTE_BASE_ID}/datasources`,
  DataSourcesNew: `/${ROUTE_BASE_ID}/datasources/new`,
  DataSourcesEdit: `/${ROUTE_BASE_ID}/datasources/edit/:uid`,
  DataSourcesDashboards: `/${ROUTE_BASE_ID}/datasources/edit/:uid/dashboards`,
  ConnectData: `/${ROUTE_BASE_ID}/connect-data`,
} as const;

// The ID of the app plugin that we render under that "Cloud Integrations" tab
export const CLOUD_ONBOARDING_APP_ID = 'grafana-easystart-app';

// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'connections';

export const ROUTES = {
  Base: `/${ROUTE_BASE_ID}`,

  // Your Connections
  YourConnections: `/${ROUTE_BASE_ID}/your-connections`,

  // Your Connections / Datasources
  DataSources: `/${ROUTE_BASE_ID}/your-connections/datasources`,
  DataSourcesNew: `/${ROUTE_BASE_ID}/your-connections/datasources/new`,
  DataSourcesEdit: `/${ROUTE_BASE_ID}/your-connections/datasources/edit/:uid`,
  DataSourcesDashboards: `/${ROUTE_BASE_ID}/datasources/edit/:uid/dashboards`,

  // Connect Data
  ConnectData: `/${ROUTE_BASE_ID}/connect-data`,
  DataSourcesDetails: `/${ROUTE_BASE_ID}/connect-data/datasources/:id`,
} as const;

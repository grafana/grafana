// The ID of the app plugin that we render under that "Cloud Integrations" tab
export const CLOUD_ONBOARDING_APP_ID = 'grafana-easystart-app';

// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'data-connections';

export enum ROUTES {
  DataSources = '/data-connections/datasources',
  DataSourcesNew = '/data-connections/datasources/new',
  DataSourcesEdit = '/data-connections/datasources/edit/:uid',
  DataSourcesDashboards = '/data-connections/datasources/edit/:uid/dashboards',
  Plugins = '/data-connections/plugins',
  CloudIntegrations = '/data-connections/cloud-integrations',
}

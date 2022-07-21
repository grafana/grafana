// The ID of the app plugin that we render under that "Cloud Integrations" tab
export const CLOUD_ONBOARDING_APP_ID = 'grafana-easystart-app';

// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'data-connections';

export enum ROUTES {
  DataSources = '/data-connections/data-sources',
  Plugins = '/data-connections/plugins',
  CloudIntegrations = '/data-connections/cloud-integrations',
  RecordedQueries = '/data-connections/recorded-queries',
}

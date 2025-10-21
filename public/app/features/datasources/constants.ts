import { DataSourcesRoutes } from './types';

/**
 * Default routes for data sources pages.
 * (Links to the pages can be overriden for this feature by using `DataSourcesRoutesContext`)
 */
export const DATASOURCES_ROUTES: DataSourcesRoutes = {
  List: '/datasources',
  Edit: '/datasources/edit/:uid',
  Dashboards: '/datasources/edit/:uid/dashboards',
  New: '/datasources/new',
} as const;

/**
 * Plugin IDs that are allowed to contribute extensions to:
 * - DataSourceConfigActions (header action buttons)
 * - DataSourceConfigStatus (testing status links)
 * - DataSourceConfigErrorStatus (error help links)
 *
 * Note: These plugins cannot contribute to the main configuration form.
 * For form components, see useDataSourceConfigPluginExtensions
 * allowlist from the EditDataSource component.
 */
export const ALLOWED_DATASOURCE_EXTENSION_PLUGINS = [
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
  'grafana-pyroscope-app',
  'grafana-monitoring-app',
  'grafana-troubleshooting-app',
  'grafana-assistant-app',
];

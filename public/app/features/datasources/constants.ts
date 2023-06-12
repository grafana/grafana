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

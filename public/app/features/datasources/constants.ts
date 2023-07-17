type DataSourcesRoutes = {
  New: string;
  Edit: string;
  List: string;
  Dashboards: string;
};

/**
 * Default routes for data sources pages.
 * These are outdated routes, only used for redirection now.
 */
export const DATASOURCES_ROUTES: DataSourcesRoutes = {
  List: '/datasources',
  Edit: '/datasources/edit/:uid',
  Dashboards: '/datasources/edit/:uid/dashboards',
  New: '/datasources/new',
} as const;

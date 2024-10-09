// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'connections';

export const RELATIVE_ROUTES = {
  Base: '',

  // Data sources
  DataSources: `/datasources`,
  DataSourcesNew: `/datasources/new`,
  DataSourcesEdit: `/datasources/edit/:uid`,
  DataSourcesDashboards: `/datasources/edit/:uid/dashboards`,

  // Add new connection
  AddNewConnection: `/add-new-connection`,
  DataSourcesDetails: `/datasources/:id`,

  // Outdated
  ConnectDataOutdated: `/connect-data`,
  YourConnectionsOutdated: `/your-connections`,
} as const;

export const ROUTES = Object.fromEntries(
  Object.entries(RELATIVE_ROUTES).map(([key, value]) => [key, `/${ROUTE_BASE_ID}${value}`])
);

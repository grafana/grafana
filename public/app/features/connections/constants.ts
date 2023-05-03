// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'connections';

export const ROUTES = {
  Base: `/${ROUTE_BASE_ID}`,

  // Data sources
  DataSources: `/${ROUTE_BASE_ID}/datasources`,
  DataSourcesNew: `/${ROUTE_BASE_ID}/datasources/new`,
  DataSourcesEdit: `/${ROUTE_BASE_ID}/datasources/edit/:uid`,
  DataSourcesDashboards: `/${ROUTE_BASE_ID}/datasources/edit/:uid/dashboards`,

  // Add new connection
  AddNewConnection: `/${ROUTE_BASE_ID}/add-new-connection`,
  DataSourcesDetails: `/${ROUTE_BASE_ID}/datasources/:id`,
} as const;

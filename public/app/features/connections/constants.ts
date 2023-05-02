// The ID of the main nav-tree item (the main item in the NavIndex)
export const ROUTE_BASE_ID = 'connections';

export const ROUTES = {
  Base: `/${ROUTE_BASE_ID}`,

  // Your Datasources
  DataSources: `/${ROUTE_BASE_ID}/your-datasources`,
  DataSourcesNew: `/${ROUTE_BASE_ID}/your-datasources/new`,
  DataSourcesEdit: `/${ROUTE_BASE_ID}/your-datasources/edit/:uid`,
  DataSourcesDashboards: `/${ROUTE_BASE_ID}/your-datasources/edit/:uid/dashboards`,

  // Add new connection
  AddNewConnection: `/${ROUTE_BASE_ID}/add-new-connection`,
  DataSourcesDetails: `/${ROUTE_BASE_ID}/datasources/:id`,
} as const;

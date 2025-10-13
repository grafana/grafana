// Helper function to get the base path for a dashboard URL for comparison purposes.
// e.g., /d/dashboardId/slug -> /d/dashboardId
//       /d/dashboardId      -> /d/dashboardId
export function getDashboardPathForComparison(pathname: string): string {
  return pathname.split('/').slice(0, 3).join('/');
}

export function normalizePath(path: string): string {
  // Remove query + hash + trailing slash (except root)
  const noQuery = path.split('?')[0].split('#')[0];
  return noQuery !== '/' && noQuery.endsWith('/') ? noQuery.slice(0, -1) : noQuery;
}

// Pathname comes from location.pathname
export function isCurrentPath(pathname: string, to: string): boolean {
  const isDashboard = to.startsWith('/d/');

  if (isDashboard) {
    // For dashboards, the title is appended to the path when we navigate to just the dashboard id, hence we need to disregard this
    return getDashboardPathForComparison(pathname) === normalizePath(to);
  }
  //Ignore query params
  return pathname === normalizePath(to);
}

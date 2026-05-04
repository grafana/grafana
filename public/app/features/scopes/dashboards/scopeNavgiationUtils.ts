import { type SuggestedNavigationsFoldersMap } from './types';

// Helper function to get the base path for a dashboard URL for comparison purposes.
// e.g., /d/dashboardId/slug -> /d/dashboardId
//       /d/dashboardId      -> /d/dashboardId
export function getDashboardPathForComparison(pathname: string): string {
  return pathname.split('/').slice(0, 3).join('/');
}

/**
 * Finds the path to a folder with the given subScopeName by searching recursively.
 * @param subScope - The subScope name to find
 * @param folders - The root folder structure to search
 * @returns Array representing the path to the folder, or undefined if not found
 */
export function buildSubScopePath(subScope: string, folders: SuggestedNavigationsFoldersMap): string[] | undefined {
  function findPath(currentFolders: SuggestedNavigationsFoldersMap, currentPath: string[]): string[] | undefined {
    for (const [key, folder] of Object.entries(currentFolders)) {
      const newPath = [...currentPath, key];
      if (folder.subScopeName === subScope) {
        return newPath;
      }
      // Search in nested folders
      const nestedPath = findPath(folder.folders, newPath);
      if (nestedPath) {
        return nestedPath;
      }
    }
    return undefined;
  }

  return findPath(folders, []);
}

export function normalizePath(path: string): string {
  // Remove query + hash + trailing slash (except root)
  const noQuery = path.split('?')[0].split('#')[0];
  return noQuery !== '/' && noQuery.endsWith('/') ? noQuery.slice(0, -1) : noQuery;
}

/**
 * Deserializes a comma-separated folder path string into an array.
 * Handles URL-encoded strings.
 */
export function deserializeFolderPath(navScopePath: string): string[] {
  if (!navScopePath) {
    return [];
  }
  try {
    const decoded = decodeURIComponent(navScopePath);
    return decoded.split(',').map((s) => s.trim());
  } catch {
    return navScopePath.split(',').map((s) => s.trim());
  }
}

/**
 * Serializes a folder path array into a comma-separated string.
 */
export function serializeFolderPath(path: string[]): string {
  if (!path) {
    return '';
  }
  return encodeURIComponent(path.join(','));
}

// Helper function to get the base path for an app plugin URL for comparison purposes.
// e.g., /a/grafana-metricsdrilldown-app/drilldown -> /a/grafana-metricsdrilldown-app
//       /a/grafana-metricsdrilldown-app           -> /a/grafana-metricsdrilldown-app
export function getAppPathForComparison(pathname: string): string {
  return pathname.split('/').slice(0, 3).join('/');
}

// Pathname comes from location.pathname
export function isCurrentPath(pathname: string, to: string): boolean {
  const normalizedTo = normalizePath(to);
  const isDashboard = normalizedTo.startsWith('/d/');
  const isAppPlugin = normalizedTo.startsWith('/a/');

  if (isDashboard) {
    // For dashboards, the title is appended to the path when we navigate to just the dashboard id, hence we need to disregard this
    return getDashboardPathForComparison(pathname) === normalizedTo;
  }

  if (isAppPlugin) {
    // For app plugins, the app may add sub-paths (e.g., /a/grafana-metricsdrilldown-app/drilldown)
    // Compare only the base app path (/a/{app-id})
    // Note: If we ever need to link to specific subpaths within an app and distinguish between them,
    // this logic would need to be refined to check if `to` itself has a subpath.
    return getAppPathForComparison(pathname) === getAppPathForComparison(normalizedTo);
  }

  //Ignore query params
  return pathname === normalizedTo;
}

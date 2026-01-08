import { SuggestedNavigationsFoldersMap } from './types';

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

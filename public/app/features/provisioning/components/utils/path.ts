/**
 * Parameters for generating a dashboard path
 */
export interface GeneratePathParams {
  timestamp: string;
  pathFromAnnotation?: string;
  slug?: string;
  folderPath?: string;
}

/**
 * Generates a path for a dashboard based on provided parameters
 * If pathFromAnnotation is provided, it will be used as the base path
 * Otherwise, a path will be generated using the slug or a default name with timestamp
 * If folderPath is provided, it will be prepended to the path
 */
export function generatePath({ timestamp, pathFromAnnotation, slug, folderPath = '' }: GeneratePathParams): string {
  let path = '';

  if (pathFromAnnotation) {
    const hashIndex = pathFromAnnotation.indexOf('#');
    return hashIndex > 0 ? pathFromAnnotation.substring(0, hashIndex) : pathFromAnnotation;
  }

  const pathSlug = slug || `new-dashboard-${timestamp}`;
  path = `${pathSlug}.json`;

  // Add folder path if it exists
  if (folderPath) {
    return `${folderPath}/${path}`;
  }

  return path;
}

/**
 * Splits a file path into its directory and filename components.
 * e.g. "dashboards/my-dash.json" → { directory: "dashboards", filename: "my-dash.json" }
 * e.g. "my-dash.json" → { directory: "", filename: "my-dash.json" }
 */
export function splitPath(path: string): { directory: string; filename: string } {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return { directory: '', filename: path };
  }
  return { directory: path.substring(0, lastSlash), filename: path.substring(lastSlash + 1) };
}

/**
 * Joins a directory and filename into a full path.
 * e.g. ("dashboards", "my-dash.json") → "dashboards/my-dash.json"
 * e.g. ("", "my-dash.json") → "my-dash.json"
 */
export function joinPath(directory: string, filename: string): string {
  const cleanDir = directory.replace(/\/+$/, '');
  const cleanFile = filename.replace(/^\/+/, '');
  return cleanDir ? `${cleanDir}/${cleanFile}` : cleanFile;
}

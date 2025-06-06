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

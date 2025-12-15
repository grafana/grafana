/**
 * Gets the base URL before the /explore path.
 * Used for constructing explore URLs with permalinks.
 *
 * @returns The base URL (e.g., "http://localhost:3000" or "https://grafana.com")
 */
export function getExploreBaseUrl(): string {
  const match = /.*(?=\/explore)/.exec(window.location.href);
  return match ? match[0] : window.location.origin;
}

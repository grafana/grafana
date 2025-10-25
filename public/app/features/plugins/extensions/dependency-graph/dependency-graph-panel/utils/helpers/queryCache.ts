/**
 * Query Cache Management
 *
 * Centralized caching for expensive data query operations.
 */

// Memoization for expensive helper functions
const availableProvidersCache = new Map<string, string[]>();
const availableConsumersCache = new Map<string, string[]>();
const activeConsumersCache = new Map<string, string[]>();
const availableExtensionPointsCache = new Map<string, string[]>();
const availableExtensionsCache = new Map<string, string[]>();

/**
 * Get cached result for available providers
 */
export function getCachedAvailableProviders(mode: string): string[] | undefined {
  return availableProvidersCache.get(mode);
}

/**
 * Set cached result for available providers
 */
export function setCachedAvailableProviders(mode: string, result: string[]): void {
  availableProvidersCache.set(mode, result);
}

/**
 * Get cached result for available consumers
 */
export function getCachedAvailableConsumers(mode: string): string[] | undefined {
  return availableConsumersCache.get(mode);
}

/**
 * Set cached result for available consumers
 */
export function setCachedAvailableConsumers(mode: string, result: string[]): void {
  availableConsumersCache.set(mode, result);
}

/**
 * Get cached result for active consumers
 */
export function getCachedActiveConsumers(mode: string): string[] | undefined {
  return activeConsumersCache.get(mode);
}

/**
 * Set cached result for active consumers
 */
export function setCachedActiveConsumers(mode: string, result: string[]): void {
  activeConsumersCache.set(mode, result);
}

/**
 * Get cached result for available extension points
 */
export function getCachedAvailableExtensionPoints(): string[] | undefined {
  return availableExtensionPointsCache.get('default');
}

/**
 * Set cached result for available extension points
 */
export function setCachedAvailableExtensionPoints(result: string[]): void {
  availableExtensionPointsCache.set('default', result);
}

/**
 * Get cached result for available extensions
 */
export function getCachedAvailableExtensions(): string[] | undefined {
  return availableExtensionsCache.get('default');
}

/**
 * Set cached result for available extensions
 */
export function setCachedAvailableExtensions(result: string[]): void {
  availableExtensionsCache.set('default', result);
}

/**
 * Clear all caches
 */
export function clearAllQueryCaches(): void {
  availableProvidersCache.clear();
  availableConsumersCache.clear();
  activeConsumersCache.clear();
  availableExtensionPointsCache.clear();
  availableExtensionsCache.clear();
}

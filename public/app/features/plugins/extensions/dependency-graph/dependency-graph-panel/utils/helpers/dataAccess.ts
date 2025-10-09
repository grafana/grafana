import { AppPluginConfig } from '@grafana/data';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pluginDataFallback = require('../../data.json');

// Type definition for window.grafanaBootData
interface GrafanaBootData {
  settings: {
    apps: Record<string, AppPluginConfig>;
  };
}

declare global {
  interface Window {
    grafanaBootData?: GrafanaBootData;
  }
}

// Cache for expensive calculations
const cache = new Map<string, unknown>();
const ENABLE_DEBUG_LOGS = true; // Set to true for debugging

/**
 * Gets plugin data from window.grafanaBootData.settings.apps with fallback to data.json
 *
 * @returns Plugin data object
 */
export const getPluginData = (): Record<string, AppPluginConfig> => {
  // Use window.grafanaBootData.settings.apps if available, otherwise fallback to data.json
  if (typeof window !== 'undefined' && window.grafanaBootData?.settings?.apps) {
    if (ENABLE_DEBUG_LOGS) {
      console.log(
        'Using window.grafanaBootData.settings.apps',
        Object.keys(window.grafanaBootData.settings.apps).length,
        'plugins'
      );
    }
    return window.grafanaBootData.settings.apps;
  }

  // Fallback to data.json
  if (ENABLE_DEBUG_LOGS) {
    console.log('Using data.json fallback', Object.keys(pluginDataFallback).length, 'plugins');
  }
  // Type assertion to handle the fallback to data.json
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return pluginDataFallback as Record<string, AppPluginConfig>;
};

/**
 * Clears all cached graph data results.
 *
 * Call this when the underlying plugin data changes or when you want to force
 * a fresh computation of all graph data.
 */
export const clearCache = (): void => {
  cache.clear();
};

/**
 * Returns the current number of cached graph data results.
 *
 * @returns The number of entries currently in the cache
 */
export const getCacheSize = (): number => {
  return cache.size;
};

/**
 * Helper to generate cache keys
 */
export const getCacheKey = (options: Record<string, unknown>): string => {
  return JSON.stringify({
    mode: options.visualizationMode,
    providers: Array.isArray(options.selectedContentProviders) ? options.selectedContentProviders.slice().sort() : [],
    consumers: Array.isArray(options.selectedContentConsumers) ? options.selectedContentConsumers.slice().sort() : [],
    extensionPoints: Array.isArray(options.selectedExtensionPoints)
      ? options.selectedExtensionPoints.slice().sort()
      : [],
    contentConsumersForExtensionPoint: Array.isArray(options.selectedContentConsumersForExtensionPoint)
      ? options.selectedContentConsumersForExtensionPoint.slice().sort()
      : [],
  });
};

/**
 * Cache management functions
 */
export const getCachedResult = <T>(key: string): T | undefined => {
  const result = cache.get(key);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return result as T | undefined;
};

export const setCachedResult = <T>(key: string, result: T): void => {
  cache.set(key, result);
};

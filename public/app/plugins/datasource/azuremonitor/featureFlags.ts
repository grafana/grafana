import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { MultiProvider, OpenFeature } from '@openfeature/web-sdk';

import { createOpenFeatureLocalStorageProvider, createOpenFeatureOFREPWebProvider } from '@grafana/runtime';

import pluginJson from './plugin.json';

// OpenFeature is a window-global singleton, so evaluations go through a
// plugin-scoped domain to stay isolated from Grafana core and other plugins.
export const OPEN_FEATURE_DOMAIN = pluginJson.id;

// Registered in pkg/services/featuremgmt/registry.go.
export const BATCH_API_FLAG = 'datasources.azureMonitorBatchAPI';

/**
 * Registers read-only proxies of Grafana's own providers under the plugin's
 * domain. Grafana initializes the underlying providers before plugins load, so
 * the proxies resolve synchronously with no extra flag fetch. Call once at
 * plugin module load.
 */
export function initFeatureFlags(): void {
  // Register when the domain does not already have a provider,
  // so module re-evaluation does not reset OpenFeature state.
  if (OpenFeature.getProvider(OPEN_FEATURE_DOMAIN) === OpenFeature.getProvider()) {
    OpenFeature.setProvider(
      OPEN_FEATURE_DOMAIN,
      new MultiProvider([
        { provider: createOpenFeatureLocalStorageProvider() },
        { provider: createOpenFeatureOFREPWebProvider() },
      ])
    );
  }
}

/**
 * Synchronous read of the Metrics Batch API flag.
 */
export function isBatchAPIFlagEnabled(): boolean {
  return OpenFeature.getClient(OPEN_FEATURE_DOMAIN).getBooleanValue(BATCH_API_FLAG, true);
}

/** React hook for the flag; re-renders when the provider (re)initializes. */
export function useBatchAPIFlag(): boolean {
  return useBooleanFlagValue(BATCH_API_FLAG, true);
}

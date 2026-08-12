import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { useEffect, useState } from 'react';

import { config, createOpenFeatureOFREPWebProvider } from '@grafana/runtime';

import pluginJson from './plugin.json';

// OpenFeature is a window-global singleton, so evaluations go through a
// plugin-scoped domain to stay isolated from Grafana core and other plugins.
export const OPEN_FEATURE_DOMAIN = pluginJson.id;

// Registered in pkg/services/featuremgmt/registry.go.
export const BATCH_API_FLAG = 'datasources.azureMonitorBatchAPI';

/**
 * Registers a read-only proxy of Grafana's OFREP provider under the plugin's
 * domain. Grafana initializes the underlying provider before plugins load, so
 * the proxy resolves synchronously with no extra flag fetch. Call once at
 * plugin module load.
 */
export function initFeatureFlags(): void {
  // Skip when the domain already has a provider so module re-evaluation does
  // not reset OpenFeature state.
  if (OpenFeature.getProvider(OPEN_FEATURE_DOMAIN) !== OpenFeature.getProvider()) {
    return;
  }
  OpenFeature.setProvider(OPEN_FEATURE_DOMAIN, createOpenFeatureOFREPWebProvider(), {
    // Must match core's own evaluation context for consistent results.
    targetingKey: config.namespace,
    ...config.openFeatureContext,
  });
}

/**
 * Synchronous read of the Metrics Batch API flag. Falls back to the bootstrap
 * `config.featureToggles` value when the provider has no authoritative answer
 * (flag not in the bulk response, provider errored or never initialized —
 * e.g. anonymous sessions, where core skips OFREP initialization).
 */
export function isBatchAPIFlagEnabled(): boolean {
  const details = OpenFeature.getClient(OPEN_FEATURE_DOMAIN).getBooleanDetails(BATCH_API_FLAG, false);
  if (details.errorCode) {
    return Boolean(config.featureToggles[BATCH_API_FLAG]);
  }
  return details.value;
}

/** React hook for the flag; re-renders when the provider (re)initializes. */
export function useBatchAPIFlag(): boolean {
  const [enabled, setEnabled] = useState(isBatchAPIFlagEnabled);

  useEffect(() => {
    const client = OpenFeature.getClient(OPEN_FEATURE_DOMAIN);
    // Provider events fire before the client exposes the new values, so the
    // read is deferred a microtask.
    const update = () => queueMicrotask(() => setEnabled(isBatchAPIFlagEnabled()));
    client.addHandler(ProviderEvents.Ready, update);
    client.addHandler(ProviderEvents.ConfigurationChanged, update);
    // Synchronous re-read in case the provider became ready between render
    // and effect; only event handlers need the microtask deferral.
    setEnabled(isBatchAPIFlagEnabled());
    return () => {
      client.removeHandler(ProviderEvents.Ready, update);
      client.removeHandler(ProviderEvents.ConfigurationChanged, update);
    };
  }, []);

  return enabled;
}

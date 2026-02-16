import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { OpenFeature, ProviderEvents, NOOP_PROVIDER, EventDetails } from '@openfeature/react-sdk';

import { FeatureToggles } from '@grafana/data';

import { config } from '../../config';
import { logError } from '../../utils/logging';

function checkDefaultProvider(event?: EventDetails) {
  if (event?.domain) {
    return;
  }

  // Warn plugin developers if we've detected OpenFeature's default provider has been changed,
  //  as plugins should always be using a domain when setting a provider to avoid conflicts.
  if (OpenFeature.getProvider() !== NOOP_PROVIDER) {
    const err = new Error(
      'OpenFeature default domain provider has been unexpectedly changed. This may be caused by a plugin that is incorrectly using the default domain.',
      { cause: OpenFeature.getProvider() }
    );
    console.error(err);
    logError(err);
  }
}

export type FeatureFlagName = keyof FeatureToggles;

// The domain creates the unique instance of the OpenFeature client for Grafana core,
// with its own evaluation context and provider.
// Plugins should not use this client or domain, and instead create their own client
// with a different domain to avoid conflicts.
//
// If changing this, you MUST also update the same constant in packages/grafana-test-utils/src/utilities/featureFlags.ts
// to ensure tests work correctly.
export const GRAFANA_CORE_OPEN_FEATURE_DOMAIN = 'internal-grafana-core';

export async function initOpenFeature() {
  OpenFeature.addHandler(ProviderEvents.Ready, checkDefaultProvider);
  OpenFeature.addHandler(ProviderEvents.Error, checkDefaultProvider);

  const subPath = config.appSubUrl || '';
  const baseUrl = `${subPath}/apis/features.grafana.app/v0alpha1/namespaces/${config.namespace}`;

  const ofProvider = new OFREPWebProvider({
    baseUrl: baseUrl,
    pollInterval: -1, // disable polling
    timeoutMs: 5_000,
  });

  await OpenFeature.setProviderAndWait(GRAFANA_CORE_OPEN_FEATURE_DOMAIN, ofProvider, {
    targetingKey: config.namespace,
    ...config.openFeatureContext,
  });
}

/**
 * Get the OpenFeature client for Grafana core.
 * Prefer to instead use the React hooks for evaluating feature flags instead as they remain up to date with the latest flag values.
 * If you must use this client directly, do not store the evaluation result for later - always call `getFeatureFlagClient().getFooValue()` just
 * in time when you use it to ensure you get the latest value.
 */
export function getFeatureFlagClient() {
  return OpenFeature.getClient(GRAFANA_CORE_OPEN_FEATURE_DOMAIN);
}

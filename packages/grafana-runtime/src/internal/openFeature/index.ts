import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { NOOP_PROVIDER, OpenFeature, ProviderEvents } from '@openfeature/web-sdk';

import { FeatureToggles } from '@grafana/data';

import { config } from '../../config';
import { logError } from '../../utils/logging';

export type FeatureFlagName = keyof FeatureToggles;

function checkDefaultProvider() {
  if (OpenFeature.getProvider() !== NOOP_PROVIDER) {
    // If a plugin has incorrectly called setProvider without a domain, log an error so we can track it.
    const err = new Error(
      'OpenFeature default domain provider has been unexpectedly changed. This may be caused by a plugin that is incorrectly using the default domain.',
      { cause: OpenFeature.getProvider() }
    );
    console.error(err);
    logError(err);
  }
}

export async function initOpenFeature() {
  /**
   * Note: Currently we don't have a way to override OpenFeature flags for tests or localStorage.
   * A few improvements we could make:
   * - When running in tests (unit or e2e?), we could use InMemoryProvider instead
   * - Use Multi-Provider to combine InMemoryProvider (for localStorage) with OFREPWebProvider
   *   to allow for overrides https://github.com/open-feature/js-sdk-contrib/tree/main/libs/providers/multi-provider
   */

  OpenFeature.addHandler(ProviderEvents.Ready, checkDefaultProvider);
  OpenFeature.addHandler(ProviderEvents.Error, checkDefaultProvider);

  const ofProvider = new OFREPWebProvider({
    baseUrl: `${config.appSubUrl || ''}/apis/features.grafana.app/v0alpha1/namespaces/${config.namespace}`,
    pollInterval: -1, // disable polling
    timeoutMs: 5_000,
  });

  await OpenFeature.setProviderAndWait(ofProvider, {
    targetingKey: config.namespace,
    ...config.openFeatureContext,
  });
}

export function evaluateBooleanFlag(flagName: FeatureFlagName, defaultValue: boolean): boolean {
  return OpenFeature.getClient().getBooleanValue(flagName, defaultValue);
}

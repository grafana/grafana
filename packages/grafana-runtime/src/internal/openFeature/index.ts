import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';

import { FeatureToggles } from '@grafana/data';

import { config } from '../../config';

export type FeatureFlagName = keyof FeatureToggles;

export async function initOpenFeature() {
  /**
   * Note: Currently we don't have a way to override OpenFeature flags for tests or localStorage.
   * A few improvements we could make:
   * - When running in tests (unit or e2e?), we could use InMemoryProvider instead
   * - Use Multi-Provider to combine InMemoryProvider (for localStorage) with OFREPWebProvider
   *   to allow for overrides https://github.com/open-feature/js-sdk-contrib/tree/main/libs/providers/multi-provider
   */

  const ofProvider = new OFREPWebProvider({
    baseUrl: '/apis/features.grafana.app/v0alpha1/namespaces/' + config.namespace,
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

export function evaluateStringFlag(flagName: FeatureFlagName, defaultValue: string): string {
  return OpenFeature.getClient().getStringValue(flagName,defaultValue)
}

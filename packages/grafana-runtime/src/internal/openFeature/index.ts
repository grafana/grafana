import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';

import { FeatureToggles } from '@grafana/data';

import { config } from '../../config';

export type FeatureFlagName = keyof FeatureToggles;

let hasDefaultDomainWarned = false;
const defaultDomainWarning = () => {
  if (!hasDefaultDomainWarned) {
    console.warn("Access to mutate OpenFeature default domain blocked, please specify a domain");
    hasDefaultDomainWarned = true;
  }
};

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

  const originalSetProviderAndWait = OpenFeature.setProviderAndWait.bind(OpenFeature);
  OpenFeature.setProviderAndWait = (async (...args: Parameters<typeof OpenFeature.setProviderAndWait>) => {
    if (typeof args[0] !== 'string') {
      defaultDomainWarning();
      return Promise.resolve();
    }
    return originalSetProviderAndWait(...args);
  }) as typeof OpenFeature.setProviderAndWait;

  const originalSetProvider = OpenFeature.setProvider.bind(OpenFeature);
  OpenFeature.setProvider = ((...args: Parameters<typeof OpenFeature.setProvider>) => {
    if (typeof args[0] !== 'string') {
      defaultDomainWarning();
      return;
    }
    return originalSetProvider(...args);
  }) as typeof OpenFeature.setProvider;

  const originalSetContext = OpenFeature.setContext.bind(OpenFeature);
  OpenFeature.setContext = ((...args: Parameters<typeof OpenFeature.setContext>) => {
    if (typeof args[0] !== 'string') {
      defaultDomainWarning();
      return Promise.resolve();
    }
    return originalSetContext(...args);
  }) as typeof OpenFeature.setContext;

  const originalClearContext = OpenFeature.clearContext.bind(OpenFeature);
  OpenFeature.clearContext = ((...args: Parameters<typeof OpenFeature.clearContext>) => {
    if (typeof args[0] !== 'string') {
      defaultDomainWarning();
      return Promise.resolve();
    }
    return originalClearContext(...args);
  }) as typeof OpenFeature.clearContext;

  OpenFeature.clearContexts = () => {
    defaultDomainWarning()
    return Promise.resolve();
  };

  OpenFeature.clearProviders = () => {
    defaultDomainWarning();
    return Promise.resolve();
  };
}

export function evaluateBooleanFlag(flagName: FeatureFlagName, defaultValue: boolean): boolean {
  return OpenFeature.getClient().getBooleanValue(flagName, defaultValue);
}

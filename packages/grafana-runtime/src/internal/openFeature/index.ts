import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';

import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';

export type FeatureFlagName = keyof FeatureToggles;

export async function initOpenFeature() {
  const ofProvider = new OFREPWebProvider({
    baseUrl: '/apis/features.grafana.app/v0alpha1/namespaces/' + config.namespace,
    pollInterval: -1, // disable polling
    timeoutMs: 5_000,
  });

  await OpenFeature.setProviderAndWait(ofProvider, {
    targetingKey: config.namespace,
    namespace: config.namespace,
  });

  return true;
}

export function getOpenFeatureClient() {
  return OpenFeature.getClient();
}

export function evaluateBooleanFlag(flagName: FeatureFlagName, defaultValue = false): boolean {
  return getOpenFeatureClient().getBooleanValue(flagName, defaultValue);
}

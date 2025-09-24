import { OpenFeature } from '@openfeature/web-sdk';

import { FeatureToggles } from '@grafana/data';

export type FeatureFlagName = keyof FeatureToggles;

export function getClient() {
  return OpenFeature.getClient();
}

export function evaluateBooleanFlag(flagName: FeatureFlagName, defaultValue = false): boolean {
  return getClient().getBooleanValue(flagName, defaultValue);
}

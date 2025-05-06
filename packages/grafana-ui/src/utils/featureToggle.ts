import { FeatureToggles } from '@grafana/data';

type FeatureToggleName = keyof FeatureToggles;

/**
 * Check a featureToggle
 * @param featureName featureToggle name
 * @param def default value if featureToggles aren't defined, false if not provided
 * @returns featureToggle value or def.
 */
export function getFeatureToggle(featureName: FeatureToggleName, def = false) {
  return window.grafanaBootData?.settings.featureToggles[featureName] ?? def;
}

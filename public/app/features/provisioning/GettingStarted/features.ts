import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';

export const requiredFeatureToggles: Array<keyof FeatureToggles> = [
  'provisioning',
  'kubernetesDashboards',
  'secretsManagementAppPlatform',
];

/**
 * Checks if all required feature toggles are enabled
 * @returns true if all required feature toggles are enabled
 */
export const checkRequiredFeatures = (): boolean => {
  const featureToggles = config.featureToggles || {};
  return requiredFeatureToggles.every((toggle) => featureToggles[toggle]);
};

/**
 * Checks if public access is configured
 * @returns true if the app URL is configured for external access
 */
export const checkPublicAccess = (): boolean => {
  return Boolean(config.appUrl && config.appUrl.indexOf('://localhost') < 0);
};

/**
 * Checks if image renderer is configured
 * @returns true if the image renderer is available
 */
export const checkImageRenderer = (): boolean => {
  return Boolean(config.rendererAvailable);
};

/**
 * Returns the configuration status of all features
 * @returns Object containing the status of required and optional features
 */
export const getConfigurationStatus = () => {
  const hasRequiredFeatures = checkRequiredFeatures();
  const hasPublicAccess = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();

  return {
    hasRequiredFeatures,
    hasPublicAccess,
    hasImageRenderer,
    missingOnlyOptionalFeatures: hasRequiredFeatures && (!hasPublicAccess || !hasImageRenderer),
    missingRequiredFeatures: !hasRequiredFeatures,
    everythingConfigured: hasRequiredFeatures && hasPublicAccess && hasImageRenderer,
  };
};

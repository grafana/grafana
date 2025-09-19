import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RepositoryViewList } from 'app/api/clients/provisioning/v0alpha1';

export const requiredFeatureToggles: Array<keyof FeatureToggles> = ['provisioning', 'kubernetesDashboards'];

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
 * Checks if image rendering is allowed by provisioning configuration
 * @param settings - Provisioning settings from the backend
 * @returns true if image rendering is allowed for provisioning workflows
 */
export const checkImageRenderingAllowed = (settings?: RepositoryViewList): boolean => {
  // Default to true if settings are not available
  return settings?.allowImageRendering !== false;
};

/**
 * Returns the configuration status of all features
 * @param settings - Optional provisioning settings from the backend
 * @returns Object containing the status of required and optional features
 */
export const getConfigurationStatus = (settings?: RepositoryViewList) => {
  const hasRequiredFeatures = checkRequiredFeatures();
  const hasPublicAccess = checkPublicAccess();
  const hasImageRenderer = checkImageRenderer();
  const imageRenderingAllowed = checkImageRenderingAllowed(settings);

  return {
    hasRequiredFeatures,
    hasPublicAccess,
    hasImageRenderer,
    imageRenderingAllowed,
    missingOnlyOptionalFeatures: hasRequiredFeatures && (!hasPublicAccess || !hasImageRenderer),
    missingRequiredFeatures: !hasRequiredFeatures,
    everythingConfigured: hasRequiredFeatures && hasPublicAccess && hasImageRenderer && imageRenderingAllowed,
  };
};

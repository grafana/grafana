import { FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';

import { isAdmin } from './utils/misc';

export const shouldUsePrometheusRulesPrimary = () => config.featureToggles.alertingPrometheusRulesPrimary ?? false;

export const shouldUseAlertingListViewV2 = () => config.featureToggles.alertingListViewV2 ?? false;

export const useGrafanaManagedRecordingRulesSupport = () =>
  config.unifiedAlerting.recordingRulesEnabled && config.featureToggles.grafanaManagedRecordingRules;

export const shouldAllowRecoveringDeletedRules = () =>
  (isAdmin() && config.featureToggles.alertingRuleRecoverDeleted && config.featureToggles.alertRuleRestore) ?? false;

export const shouldAllowPermanentlyDeletingRules = () =>
  (shouldAllowRecoveringDeletedRules() && config.featureToggles.alertingRulePermanentlyDelete) ?? false;

export function setLocalStorageFeatureToggle(featureName: keyof FeatureToggles, value: boolean | undefined) {
  const featureToggles = localStorage.getItem('grafana.featureToggles') ?? '';

  const newToggles = updateFeatureToggle(featureToggles, featureName, value);
  localStorage.setItem('grafana.featureToggles', newToggles);
}

function updateFeatureToggle(
  featureToggles: string | undefined,
  featureName: string,
  value: boolean | undefined
): string {
  if (!featureToggles) {
    if (value !== undefined) {
      return `${featureName}=${value}`;
    }
    return '';
  }

  const parts = featureToggles.split(',');
  const featurePrefix = `${featureName}=`;
  const featureIndex = parts.findIndex((part) => part.startsWith(featurePrefix));

  if (featureIndex !== -1) {
    if (value === undefined) {
      // Remove the feature
      parts.splice(featureIndex, 1);
    } else {
      // Update the feature value
      parts[featureIndex] = `${featureName}=${value}`;
    }
  } else if (value !== undefined) {
    // Add new feature
    parts.push(`${featureName}=${value}`);
  }

  return parts.join(',');
}

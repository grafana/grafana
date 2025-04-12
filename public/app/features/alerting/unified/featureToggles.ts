import { useLocalStorage } from 'react-use';

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

export function useFeatureToggle(featureName: keyof FeatureToggles) {
  const [featureToggles, setFeatureToggles] = useLocalStorage<string>('grafana.featureToggles', '', {
    raw: true,
  });

  const toggleValue = getToggleValue(featureToggles, featureName);

  const setToggle = (value: boolean | undefined) => {
    const newToggles = updateFeatureToggle(featureToggles, featureName, value);
    setFeatureToggles(newToggles);
  };

  return [toggleValue, setToggle] as const;
}

function getToggleValue(featureToggles: string | undefined, featureName: string): boolean | undefined {
  const pattern = new RegExp(`${featureName}=([^,]+)`);
  const match = featureToggles?.match(pattern);
  if (!match) {
    return undefined;
  }
  return match[1] === 'true' || match[1] === '1';
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

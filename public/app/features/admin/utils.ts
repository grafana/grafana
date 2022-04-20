import { config } from '@grafana/runtime/src';

export function isTrial() {
  const expiry = config.licenseInfo?.trialExpiry;
  return !!(expiry && expiry > 0);
}

export const highlightTrial = () => isTrial() && config.featureToggles.featureHighlights;

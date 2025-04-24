import { config } from '@grafana/runtime';

// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
export const w3cStandardEmailValidator =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isTrial() {
  const expiry = config.licenseInfo?.trialExpiry;
  return !!(expiry && expiry > 0);
}

export const highlightTrial = () => isTrial() && config.featureToggles.featureHighlights;

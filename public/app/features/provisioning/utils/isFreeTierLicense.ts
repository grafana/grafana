import { config } from '@grafana/runtime';

import { isOnPrem } from './isOnPrem';

/**
 * Checks if the current Grafana instance is on a free tier license
 *
 * Free tier is defined as:
 * - Cloud instance (not on-prem) AND
 * - Not licensed (unlicensed or trial)
 *
 * @returns true if the instance is a free tier cloud instance
 */
export function isFreeTierLicense() {
  return !isOnPrem() && config.licenseInfo.stateInfo !== 'Licensed';
}

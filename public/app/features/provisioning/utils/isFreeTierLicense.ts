import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';

/**
 * Checks if the current Grafana instance is on a free tier license
 */
export function isFreeTierLicense() {
  return config.licenseInfo.edition === GrafanaEdition.Trial;
}

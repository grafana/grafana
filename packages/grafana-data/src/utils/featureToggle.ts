import { BootData } from '../types';

declare global {
  interface Window {
    grafanaBootData?: BootData;
  }
}

/**
 * Grafana data does not have access to runtime, so we are accessing the window object to get the feature toggles.
 *
 * @returns Grafana feature toggles object
 */
export function getGrafanaFeatureToggles() {
  return window.grafanaBootData?.settings?.featureToggles;
}

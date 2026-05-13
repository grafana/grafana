/**
 * Browser-local feature toggle overrides — mirrors `overrideFeatureTogglesFromLocalStorage` in `@grafana/runtime`
 * (`grafana.featureToggles`, comma-separated `name=value`).
 */

import { store } from '@grafana/data';

export const GRAFANA_FEATURE_TOGGLES_LS_KEY = 'grafana.featureToggles';

export function parseFeatureToggleLocalOverrides(raw: string | undefined | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw?.trim()) {
    return out;
  }
  for (const segment of raw.split(',')) {
    const [name, value] = segment.split('=').map((s) => s.trim());
    if (!name) {
      continue;
    }
    out[name] = value === 'true' || value === '1';
  }
  return out;
}

export function stringifyFeatureToggleLocalOverrides(entries: Record<string, boolean>): string {
  return Object.entries(entries)
    .map(([k, v]) => `${k}=${v ? 'true' : 'false'}`)
    .join(',');
}

export function readFeatureToggleLocalOverridesFromBrowser(): Record<string, boolean> {
  return parseFeatureToggleLocalOverrides(store.get(GRAFANA_FEATURE_TOGGLES_LS_KEY));
}

export function writeFeatureToggleLocalOverridesToBrowser(entries: Record<string, boolean>): void {
  const serialized = stringifyFeatureToggleLocalOverrides(entries);
  if (serialized) {
    store.set(GRAFANA_FEATURE_TOGGLES_LS_KEY, serialized);
    return;
  }
  clearFeatureToggleLocalOverridesInBrowser();
}

export function clearFeatureToggleLocalOverridesInBrowser(): void {
  store.delete(GRAFANA_FEATURE_TOGGLES_LS_KEY);
}

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

/** Spike toggle: set to 'legacy' in local storage to compare against the react-grid-layout grid */
export const CUSTOM_GRID_ENGINE_STORAGE_KEY = 'grafana.dashboard.customGridEngine';

export function isCustomGridEngineEnabled(): boolean {
  // dashboardNewLayouts has no OpenFeature flag key yet, this matches how the rest of the layouts read it
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  if (!config.featureToggles.dashboardNewLayouts) {
    return false;
  }

  return store.get(CUSTOM_GRID_ENGINE_STORAGE_KEY) !== 'legacy';
}

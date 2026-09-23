import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

/**
 * Spike toggle for the unified drag and drop engine (custom grid, rows and tabs). Set to 'legacy'
 * in local storage to compare against react-grid-layout and hello-pangea/dnd.
 */
export const DND_ENGINE_STORAGE_KEY = 'grafana.dashboard.dndEngine';

export function isDndEngineEnabled(): boolean {
  // dashboardNewLayouts has no OpenFeature flag key yet, this matches how the rest of the layouts read it
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  if (!config.featureToggles.dashboardNewLayouts) {
    return false;
  }

  return store.get(DND_ENGINE_STORAGE_KEY) !== 'legacy';
}

import { store } from '@grafana/data';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

/**
 * Spike toggle for the unified drag and drop engine (custom grid, rows and tabs). Set to 'legacy'
 * in local storage to compare against react-grid-layout and hello-pangea/dnd.
 */
export const DND_ENGINE_STORAGE_KEY = 'grafana.dashboard.dndEngine';

export function isDndEngineEnabled(): boolean {
  if (!isDashboardNewLayoutsEnabled()) {
    return false;
  }

  return store.get(DND_ENGINE_STORAGE_KEY) !== 'legacy';
}

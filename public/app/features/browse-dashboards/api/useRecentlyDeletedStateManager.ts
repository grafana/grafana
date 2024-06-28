import { initialState, SearchStateManager } from '../../search/state/SearchStateManager';

let recentlyDeletedStateManager: SearchStateManager;
function getRecentlyDeletedStateManager() {
  if (!recentlyDeletedStateManager) {
    recentlyDeletedStateManager = new SearchStateManager({ ...initialState, includePanels: false, deleted: true });
  }

  return recentlyDeletedStateManager;
}

export function useRecentlyDeletedStateManager() {
  const stateManager = getRecentlyDeletedStateManager();
  const state = stateManager.useState();

  return [state, stateManager] as const;
}

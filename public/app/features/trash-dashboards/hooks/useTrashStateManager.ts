import { initialState, SearchStateManager } from '../../search/state/SearchStateManager';

let trashStateManager: SearchStateManager;
function getTrashStateManager() {
  if (!trashStateManager) {
    trashStateManager = new SearchStateManager({ ...initialState, includePanels: false, deleted: true });
  }

  return trashStateManager;
}

export function useTrashStateManager() {
  const stateManager = getTrashStateManager();
  const state = stateManager.useState();

  return [state, stateManager] as const;
}

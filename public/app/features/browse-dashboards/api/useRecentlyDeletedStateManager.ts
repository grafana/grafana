import { SEARCH_SELECTED_SORT } from 'app/features/search/constants';
import { SearchState } from 'app/features/search/types';

import { initialState, SearchStateManager } from '../../search/state/SearchStateManager';

export class TrashStateManager extends SearchStateManager {
  setStateAndDoSearch(state: Partial<SearchState>) {
    const sort = state.sort || this.state.sort || localStorage.getItem(SEARCH_SELECTED_SORT) || undefined;

    const query = state.query ?? this.state.query;
    const tags = state.tag ?? this.state.tag;

    const shouldEmpty = query.length === 0 && tags.length === 0;

    console.log('shouldEmpty', shouldEmpty, { query, tags });

    // Set internal state
    this.setState({ sort, ...state, result: shouldEmpty ? undefined : this.state.result });

    // Update url state
    this.updateLocation({
      query: this.state.query.length === 0 ? null : this.state.query,
      tag: this.state.tag,
      datasource: this.state.datasource,
      panel_type: this.state.panel_type,
      starred: this.state.starred ? this.state.starred : null,
      sort: this.state.sort,
    });

    // Prevent searching when user is only clearing the input.
    // We don't show these results anyway
    if (this.hasSearchFilters()) {
      this.doSearchWithDebounce();
    }
  }
}

let recentlyDeletedStateManager: TrashStateManager;
function getRecentlyDeletedStateManager() {
  if (!recentlyDeletedStateManager) {
    recentlyDeletedStateManager = new TrashStateManager({ ...initialState, includePanels: false, deleted: true });
  }

  return recentlyDeletedStateManager;
}

export function useRecentlyDeletedStateManager() {
  const stateManager = getRecentlyDeletedStateManager();
  const state = stateManager.useState();

  return [state, stateManager] as const;
}

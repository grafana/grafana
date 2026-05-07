import { type SelectableValue, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type TermCount } from 'app/core/components/TagFilter/TagFilter';
import {
  RECENTLY_DELETED_SORT_VALUES,
  SEARCH_SELECTED_LAYOUT_DELETED,
  SEARCH_SELECTED_SORT_DELETED,
} from 'app/features/search/constants';
import { type SearchState } from 'app/features/search/types';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { initialState, SearchStateManager } from '../../search/state/SearchStateManager';

// Subclass SearchStateManager to customize the setStateAndDoSearch behavior.
// We want to clear the search results when the user clears any search input
// to trigger the skeleton state.
export class TrashStateManager extends SearchStateManager {
  protected sortStorageKey = SEARCH_SELECTED_SORT_DELETED;
  protected layoutStorageKey = SEARCH_SELECTED_LAYOUT_DELETED;

  setStateAndDoSearch(state: Partial<SearchState>) {
    const sort = state.sort || this.state.sort || store.get(this.sortStorageKey) || undefined;

    const query = state.query ?? this.state.query;
    const tags = state.tag ?? this.state.tag;

    // When the user clears the search, and we revert back to list listing all
    const clearResults = query.length === 0 && tags.length === 0;

    // Set internal state
    this.setState({
      sort,
      result: clearResults ? undefined : this.state.result,
      ...state,
    });

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

  // Get tags from deleted dashboards cache
  getTagOptions = async (): Promise<TermCount[]> => {
    try {
      const deletedHits = await deletedDashboardsCache.get();
      const tagCounts = new Map<string, number>();

      deletedHits.forEach((hit) => {
        hit.tags.forEach((tag) => {
          if (tag) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        });
      });

      const termCounts: TermCount[] = Array.from(tagCounts.entries()).map(([term, count]) => ({
        term,
        count,
      }));

      return termCounts.sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Failed to get tags from deleted dashboards:', error);
      return [];
    }
  };

  getSortOptions = async (): Promise<SelectableValue[]> => {
    return Promise.resolve([
      {
        label: t('browse-dashboards.trash-state-manager.label.alphabetically-az', 'Alphabetically (A–Z)'),
        value: RECENTLY_DELETED_SORT_VALUES[0],
      },
      {
        label: t('browse-dashboards.trash-state-manager.label.alphabetically-za', 'Alphabetically (Z–A)'),
        value: RECENTLY_DELETED_SORT_VALUES[1],
      },
      {
        label: t('browse-dashboards.trash-state-manager.label.deleted-oldest', 'Deleted (oldest first)'),
        value: RECENTLY_DELETED_SORT_VALUES[2],
      },
      {
        label: t('browse-dashboards.trash-state-manager.label.deleted-newest', 'Deleted (newest first)'),
        value: RECENTLY_DELETED_SORT_VALUES[3],
      },
      {
        label: t('browse-dashboards.trash-state-manager.label.deleted-by-az', 'Deleted by (A–Z)'),
        value: 'deletedby-asc',
      },
      {
        label: t('browse-dashboards.trash-state-manager.label.deleted-by-za', 'Deleted by (Z–A)'),
        value: 'deletedby-desc',
      },
    ]);
  };
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

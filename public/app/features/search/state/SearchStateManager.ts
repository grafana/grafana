import { debounce } from 'lodash';
import { FormEvent } from 'react';

import { locationService } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import store from 'app/core/store';

import { SEARCH_PANELS_LOCAL_STORAGE_KEY, SEARCH_SELECTED_LAYOUT, SEARCH_SELECTED_SORT } from '../constants';
import {
  reportDashboardListViewed,
  reportSearchFailedQueryInteraction,
  reportSearchQueryInteraction,
  reportSearchResultInteraction,
} from '../page/reporting';
import { getGrafanaSearcher } from '../service/searcher';
import { SearchQuery } from '../service/types';
import { SearchLayout, SearchQueryParams, SearchState } from '../types';
import { parseRouteParams } from '../utils';

export const initialState: SearchState = {
  query: '',
  tag: [],
  starred: false,
  layout: SearchLayout.Folders,
  sort: undefined,
  prevSort: undefined,
  eventTrackingNamespace: 'dashboard_search',
  deleted: false,
};

export const defaultQueryParams: SearchQueryParams = {
  sort: null,
  starred: null,
  query: null,
  tag: null,
  layout: null,
};

const getLocalStorageLayout = () => {
  const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT);
  if (selectedLayout === SearchLayout.List) {
    return SearchLayout.List;
  } else {
    return SearchLayout.Folders;
  }
};
export class SearchStateManager extends StateManagerBase<SearchState> {
  updateLocation = debounce((query) => locationService.partial(query, true), 300);
  doSearchWithDebounce = debounce(() => this.doSearch(), 300);
  lastQuery?: SearchQuery;

  lastSearchTimestamp = 0;

  initStateFromUrl(folderUid?: string, doInitialSearch = true) {
    const stateFromUrl = parseRouteParams(locationService.getSearchObject());

    // Force list view when conditions are specified from the URL
    if (stateFromUrl.query || stateFromUrl.datasource || stateFromUrl.panel_type) {
      stateFromUrl.layout = SearchLayout.List;
    }

    const layout = getLocalStorageLayout();
    const prevSort = localStorage.getItem(SEARCH_SELECTED_SORT) ?? undefined;
    const sort = layout === SearchLayout.List ? stateFromUrl.sort || prevSort : null;

    this.setState({
      ...initialState,
      ...stateFromUrl,
      layout,
      sort: sort ?? initialState.sort,
      prevSort,
      folderUid: folderUid,
      eventTrackingNamespace: folderUid ? 'manage_dashboards' : 'dashboard_search',
      deleted: this.state.deleted,
    });

    if (doInitialSearch && this.hasSearchFilters()) {
      this.doSearch();
    }
  }

  /**
   * Updates internal and url state, then triggers a new search
   */
  setStateAndDoSearch(state: Partial<SearchState>) {
    const sort = state.sort || this.state.sort || localStorage.getItem(SEARCH_SELECTED_SORT) || undefined;

    // Set internal state
    this.setState({ sort, ...state });

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

  onCloseSearch = () => {
    this.updateLocation({
      search: null,
      folder: null,
      ...defaultQueryParams,
    });
  };

  onClearSearchAndFilters = () => {
    this.setStateAndDoSearch({
      query: '',
      datasource: undefined,
      tag: [],
      panel_type: undefined,
      starred: undefined,
      sort: undefined,
    });
  };

  onQueryChange = (query: string) => {
    this.setStateAndDoSearch({ query });
  };

  onRemoveTag = (tagToRemove: string) => {
    this.setStateAndDoSearch({ tag: this.state.tag.filter((tag) => tag !== tagToRemove) });
  };

  onTagFilterChange = (tags: string[]) => {
    this.setStateAndDoSearch({ tag: tags });
  };

  onAddTag = (newTag: string) => {
    if (this.state.tag && this.state.tag.includes(newTag)) {
      return;
    }

    this.setStateAndDoSearch({ tag: [...this.state.tag, newTag] });
  };

  onDatasourceChange = (datasource: string | undefined) => {
    this.setStateAndDoSearch({ datasource });
  };

  onPanelTypeChange = (panel_type?: string) => {
    this.setStateAndDoSearch({ panel_type });
  };

  onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = e.currentTarget.checked;
    this.setStateAndDoSearch({ starred });
  };

  onClearStarred = () => {
    this.setStateAndDoSearch({ starred: false });
  };

  onSetStarred = (starred: boolean) => {
    if (starred !== this.state.starred) {
      this.setStateAndDoSearch({ starred });
    }
  };

  onSortChange = (sort: string | undefined) => {
    if (sort) {
      localStorage.setItem(SEARCH_SELECTED_SORT, sort);
    } else {
      localStorage.removeItem(SEARCH_SELECTED_SORT);
    }

    if (this.state.layout === SearchLayout.Folders) {
      this.setStateAndDoSearch({ sort, layout: SearchLayout.List });
    } else {
      this.setStateAndDoSearch({ sort });
    }
  };

  onLayoutChange = (layout: SearchLayout) => {
    localStorage.setItem(SEARCH_SELECTED_LAYOUT, layout);

    if (this.state.sort && layout === SearchLayout.Folders) {
      this.setStateAndDoSearch({ layout, prevSort: this.state.sort, sort: undefined });
    } else {
      this.setStateAndDoSearch({ layout, sort: this.state.prevSort });
    }
  };

  onSetIncludePanels = (includePanels: boolean) => {
    this.setStateAndDoSearch({ includePanels });
    store.set(SEARCH_PANELS_LOCAL_STORAGE_KEY, includePanels);
  };

  hasSearchFilters() {
    return Boolean(
      this.state.query ||
        this.state.tag.length ||
        this.state.starred ||
        this.state.panel_type ||
        this.state.sort ||
        this.state.deleted ||
        this.state.layout === SearchLayout.List
    );
  }

  getSearchQuery() {
    const q: SearchQuery = {
      query: this.state.query,
      tags: this.state.tag,
      ds_uid: this.state.datasource,
      panel_type: this.state.panel_type,
      location: this.state.folderUid, // This will scope all results to the prefix
      sort: this.state.sort,
      explain: this.state.explain,
      withAllowedActions: this.state.explain, // allowedActions are currently not used for anything on the UI and added only in `explain` mode
      starred: this.state.starred,
      deleted: this.state.deleted,
    };

    // Only dashboards have additional properties
    if (q.sort?.length && !q.sort.includes('name')) {
      q.kind = ['dashboard', 'folder']; // skip panels
    }

    if (!q.query?.length) {
      q.query = '*';
      if (!q.location) {
        q.kind = ['dashboard', 'folder']; // skip panels
      }
    }

    if (!this.state.includePanels && !q.kind) {
      q.kind = ['dashboard', 'folder']; // skip panels
    }

    if (q.panel_type?.length) {
      q.kind = ['panel'];
    }

    return q;
  }

  private doSearch() {
    const trackingInfo = {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort,
      query: this.state.query,
      tagCount: this.state.tag?.length,
      includePanels: this.state.includePanels,
      deleted: this.state.deleted,
    };

    reportSearchQueryInteraction(this.state.eventTrackingNamespace, trackingInfo);

    this.lastQuery = this.getSearchQuery();

    this.setState({ loading: true });

    const searcher = getGrafanaSearcher();

    const searchTimestamp = Date.now();
    const searchPromise = this.state.starred ? searcher.starred(this.lastQuery) : searcher.search(this.lastQuery);

    searchPromise
      .then((result) => {
        // Only keep the results if it's was issued after the most recently resolved search.
        // This prevents results showing out of order if first request is slower than later ones
        if (searchTimestamp > this.lastSearchTimestamp) {
          this.setState({ result, loading: false });
          this.lastSearchTimestamp = searchTimestamp;
        }
      })
      .catch((error) => {
        reportSearchFailedQueryInteraction(this.state.eventTrackingNamespace, {
          ...trackingInfo,
          error: error?.message,
        });
        this.setState({ loading: false });
      });
  }

  // This gets the possible tags from within the query results
  getTagOptions = (): Promise<TermCount[]> => {
    const query = this.lastQuery ?? {
      kind: ['dashboard', 'folder'],
      query: '*',
    };
    return getGrafanaSearcher().tags(query);
  };

  /**
   * When item is selected clear some filters and report interaction
   */
  onSearchItemClicked = (e: React.MouseEvent<HTMLElement>) => {
    reportSearchResultInteraction(this.state.eventTrackingNamespace, {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort,
      query: this.state.query,
      tagCount: this.state.tag?.length,
      includePanels: this.state.includePanels,
      deleted: this.state.deleted,
    });
  };

  /**
   * Caller should handle debounce
   */
  onReportSearchUsage = () => {
    reportDashboardListViewed(this.state.eventTrackingNamespace, {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort,
      query: this.state.query,
      tagCount: this.state.tag?.length,
      includePanels: this.state.includePanels,
      deleted: this.state.deleted,
    });
  };
}

let stateManager: SearchStateManager;

export function getSearchStateManager() {
  if (!stateManager) {
    const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT) as SearchLayout;
    const layout = selectedLayout ?? initialState.layout;

    let includePanels = store.getBool(SEARCH_PANELS_LOCAL_STORAGE_KEY, true);
    if (includePanels) {
      includePanels = false;
    }

    stateManager = new SearchStateManager({ ...initialState, layout, includePanels });
  }

  return stateManager;
}

export function useSearchStateManager() {
  const stateManager = getSearchStateManager();
  const state = stateManager.useState();

  return [state, stateManager] as const;
}

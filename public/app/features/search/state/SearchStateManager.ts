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
import { getGrafanaSearcher, SearchQuery } from '../service';
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
};

export const defaultQueryParams: SearchQueryParams = {
  sort: null,
  starred: null,
  query: null,
  tag: null,
  layout: null,
};

export class SearchStateManager extends StateManagerBase<SearchState> {
  updateLocation = debounce((query) => locationService.partial(query, true), 300);
  doSearchWithDebounce = debounce(() => this.doSearch(), 300);
  lastQuery?: SearchQuery;

  initStateFromUrl(folderUid?: string) {
    const stateFromUrl = parseRouteParams(locationService.getSearchObject());

    // Force list view when conditions are specified from the URL
    if (stateFromUrl.query || stateFromUrl.datasource || stateFromUrl.panel_type) {
      stateFromUrl.layout = SearchLayout.List;
    }

    stateManager.setState({
      ...stateFromUrl,
      folderUid: folderUid,
      eventTrackingNamespace: folderUid ? 'manage_dashboards' : 'dashboard_search',
    });

    this.doSearch();
  }
  /**
   * Updates internal and url state, then triggers a new search
   */
  setStateAndDoSearch(state: Partial<SearchState>) {
    // Set internal state
    this.setState(state);

    // Update url state
    this.updateLocation({
      query: this.state.query.length === 0 ? null : this.state.query,
      tag: this.state.tag,
      datasource: this.state.datasource,
      panel_type: this.state.panel_type,
      starred: this.state.starred ? this.state.starred : null,
      sort: this.state.sort,
    });

    // issue new search query
    this.doSearchWithDebounce();
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
    return this.state.query || this.state.tag.length || this.state.starred || this.state.panel_type;
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
    };

    reportSearchQueryInteraction(this.state.eventTrackingNamespace, trackingInfo);

    this.lastQuery = this.getSearchQuery();

    this.setState({ loading: true });

    if (this.state.starred) {
      getGrafanaSearcher()
        .starred(this.lastQuery)
        .then((result) => this.setState({ result, loading: false }))
        .catch((error) => {
          reportSearchFailedQueryInteraction(this.state.eventTrackingNamespace, {
            ...trackingInfo,
            error: error?.message,
          });
          this.setState({ loading: false });
        });
    } else {
      getGrafanaSearcher()
        .search(this.lastQuery)
        .then((result) => this.setState({ result, loading: false }))
        .catch((error) => {
          reportSearchFailedQueryInteraction(this.state.eventTrackingNamespace, {
            ...trackingInfo,
            error: error?.message,
          });
          this.setState({ loading: false });
        });
    }
  }

  // This gets the possible tags from within the query results
  getTagOptions = (): Promise<TermCount[]> => {
    return getGrafanaSearcher().tags(this.lastQuery!);
  };

  /**
   * When item is selected clear some filters and report interaction
   */
  onSearchItemClicked = (e: React.MouseEvent<HTMLElement>) => {
    // Clear some filters only if we're not opening a search item in a new tab
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      this.setState({ tag: [], starred: false, sort: undefined, query: '', folderUid: undefined });
    }

    reportSearchResultInteraction(this.state.eventTrackingNamespace, {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort,
      query: this.state.query,
      tagCount: this.state.tag?.length,
      includePanels: this.state.includePanels,
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
    });
  };
}

let stateManager: SearchStateManager;

export function getSearchStateManager() {
  if (!stateManager) {
    const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT) as SearchLayout;
    const layout = selectedLayout ?? initialState.layout;
    const sort = localStorage.getItem(SEARCH_SELECTED_SORT) ?? undefined;

    let includePanels = store.getBool(SEARCH_PANELS_LOCAL_STORAGE_KEY, true);
    if (includePanels) {
      includePanels = false;
    }

    stateManager = new SearchStateManager({ ...initialState, layout, sort, includePanels });
  }

  return stateManager;
}

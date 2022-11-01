import { debounce } from 'lodash';
import { FormEvent, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { StateManagerBase } from 'app/core/services/StateManagerBase';
import store from 'app/core/store';

import { SEARCH_PANELS_LOCAL_STORAGE_KEY, SEARCH_SELECTED_LAYOUT } from '../constants';
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
  sort: null,
  starred: false,
  layout: SearchLayout.Folders,
  prevSort: null,
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
  lastQuery?: SearchQuery;

  initState(state: Partial<SearchState>) {
    this.setStateAndDoSearch(state);
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
      starred: this.state.starred ? this.state.starred : null,
      sort: this.state.sort,
    });

    // issue new search query
    this.doSearch();
  }

  onCloseSearch = () => {
    this.updateLocation({
      search: null,
      folder: null,
      ...defaultQueryParams,
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

  onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    this.setStateAndDoSearch({ starred });
  };

  onClearStarred = () => {
    this.setStateAndDoSearch({ starred: false });
  };

  onSortChange = (sort: SelectableValue | null) => {
    if (this.state.layout === SearchLayout.Folders) {
      this.setStateAndDoSearch({ sort, layout: SearchLayout.List });
    } else {
      this.setStateAndDoSearch({ sort });
    }
  };

  onLayoutChange = (layout: SearchLayout) => {
    if (this.state.sort && layout === SearchLayout.Folders) {
      this.setStateAndDoSearch({ layout, prevSort: this.state.sort, sort: null });
    } else {
      this.setStateAndDoSearch({ layout, sort: this.state.prevSort });
    }
  };

  onSetIncludePanels = (includePanels: boolean) => {
    this.setStateAndDoSearch({ includePanels });
    store.set(SEARCH_PANELS_LOCAL_STORAGE_KEY, includePanels);
  };

  getSearchQuery() {
    const q: SearchQuery = {
      query: this.state.query,
      tags: this.state.tag as string[],
      ds_uid: this.state.datasource as string,
      location: this.state.folderUid, // This will scope all results to the prefix
      sort: this.state.sort?.value,
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

    if (q.query === '*' && !q.sort?.length) {
      q.sort = 'name_sort';
    }

    return q;
  }

  doSearch = debounce((): void => {
    const trackingInfo = {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort?.value,
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
        .then((result) => this.setState({ result }))
        .catch((error) => {
          reportSearchFailedQueryInteraction(this.state.eventTrackingNamespace, {
            ...trackingInfo,
            error: error?.message,
          });
          this.setState({ loading: false });
        });
    }
  }, 300);

  // This gets the possible tags from within the query results
  getTagOptions = (): Promise<TermCount[]> => {
    return getGrafanaSearcher().tags(this.lastQuery!);
  };

  /**
   * When item is selected clear some filters and report interaction
   */
  onSearchItemClicked = () => {
    // Clear some filters
    this.setState({ tag: [], starred: false, sort: null, query: '' });
    this.onCloseSearch();

    reportSearchResultInteraction(this.state.eventTrackingNamespace, {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort?.value,
      query: this.state.query,
      tagCount: this.state.tag?.length,
      includePanels: this.state.includePanels,
    });
  };

  /**
   * Caller should handle debounce
   */
  onReportSearchUsage() {
    reportDashboardListViewed(this.state.eventTrackingNamespace, {
      layout: this.state.layout,
      starred: this.state.starred,
      sortValue: this.state.sort?.value,
      query: this.state.query,
      tagCount: this.state.tag?.length,
      includePanels: this.state.includePanels,
    });
  }
}

let stateManger: SearchStateManager;

function getSearchStateManager() {
  if (!stateManger) {
    const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT) as SearchLayout;
    const layout = selectedLayout ?? initialState.layout;

    let includePanels = store.getBool(SEARCH_PANELS_LOCAL_STORAGE_KEY, true);
    if (includePanels) {
      includePanels = false;
    }

    stateManger = new SearchStateManager({ ...initialState, layout: layout, includePanels });
  }

  return stateManger;
}

export interface InitStateManagerArgs {
  folderUid?: string;
}

export const useAndInitStateManager = ({ folderUid }: InitStateManagerArgs) => {
  const stateManger = getSearchStateManager();

  useEffect(() => {
    const stateFromUrl = parseRouteParams(locationService.getSearchObject());

    stateManger.initState({
      ...stateFromUrl,

      folderUid: folderUid,
      eventTrackingNamespace: folderUid ? 'manage_dashboards' : 'dashboard_search',
    });
  }, [folderUid, stateManger]);

  return stateManger;
};

export const useSearchStateManager = () => {
  return getSearchStateManager();
};

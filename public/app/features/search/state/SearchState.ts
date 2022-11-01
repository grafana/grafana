import { debounce } from 'lodash';
import { FormEvent, useEffect } from 'react';

import { SelectableValue, UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { SEARCH_SELECTED_LAYOUT } from '../constants';
import { DashboardQuery, SearchLayout, SearchQueryParams } from '../types';
import { parseRouteParams } from '../utils';

export const initialState: DashboardQuery = {
  query: '',
  tag: [],
  sort: null,
  starred: false,
  layout: SearchLayout.Folders,
  prevSort: null,
};

export const defaultQueryParams: SearchQueryParams = {
  sort: null,
  starred: null,
  query: null,
  tag: null,
  layout: null,
};

export class SearchStateManager extends StateManagerBase<DashboardQuery> {
  updateLocation = debounce((query) => locationService.partial(query, true), 300);

  initStateFromUrl(searchParams: UrlQueryMap) {
    const queryParams = parseRouteParams(searchParams);
    this.setState({
      ...queryParams,
    });
  }

  onCloseSearch = () => {
    locationService.partial(
      {
        search: null,
        folder: null,
        ...defaultQueryParams,
      },
      true
    );
  };

  onSelectSearchItem = () => {
    this.onClearFilters();
    locationService.partial(
      {
        search: null,
        folder: null,
        ...defaultQueryParams,
      },
      true
    );
  };

  onQueryChange = (query: string) => {
    this.setState({ query });
    this.updateLocation({ query });
  };

  onRemoveTag = (tagToRemove: string) => {
    this.setState({
      tag: this.state.tag.filter((tag) => tag !== tagToRemove),
    });
  };

  onTagFilterChange = (tags: string[]) => {
    this.setState({ tag: tags });
    this.updateLocation({ tag: tags });
  };

  onAddTag = (newTag: string) => {
    if (this.state.tag && this.state.tag.includes(newTag)) {
      return;
    }

    this.setState({ tag: [...this.state.tag, newTag] });
    this.updateLocation({ tag: [...this.state.tag, newTag] });
  };

  onDatasourceChange = (datasource: string | undefined) => {
    this.setState({ datasource });
    this.updateLocation({ datasource });
  };

  onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    this.setState({ starred });
    this.updateLocation({ starred: starred || null });
  };

  onClearStarred = () => {
    this.setState({ starred: false });
    this.updateLocation({ starred: null });
  };

  onClearFilters = () => {
    this.setState({ tag: [], starred: false, sort: null, query: '' });
    this.updateLocation(defaultQueryParams);
  };

  onSortChange = (sort: SelectableValue | null) => {
    if (this.state.layout === SearchLayout.Folders) {
      this.setState({ sort, layout: SearchLayout.List });
    } else {
      this.setState({ sort });
    }
    this.updateLocation({ sort: sort?.value, layout: SearchLayout.List });
  };

  onLayoutChange = (layout: SearchLayout) => {
    if (this.state.sort && layout === SearchLayout.Folders) {
      this.setState({ layout, prevSort: this.state.sort, sort: null });
      this.updateLocation({ layout, sort: null });
    } else {
      this.setState({ layout, sort: this.state.prevSort });
      this.updateLocation({ layout });
    }
  };
}

let stateManger: SearchStateManager;

export const useSearchStateManager = () => {
  if (!stateManger) {
    const selectedLayout = localStorage.getItem(SEARCH_SELECTED_LAYOUT) as SearchLayout;
    const layout = selectedLayout ?? initialState.layout;

    stateManger = new SearchStateManager({ ...initialState, layout: layout });
  }

  useEffect(() => {
    stateManger.initStateFromUrl(locationService.getSearchObject());
  }, []);

  return stateManger;
};

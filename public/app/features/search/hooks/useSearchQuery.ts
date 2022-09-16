import { debounce } from 'lodash';
import { FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { StoreState } from 'app/types';

import {
  defaultQueryParams,
  queryChange,
  setTags,
  addTag,
  datasourceChange,
  toggleStarred,
  removeStarred,
  clearFilters,
  toggleSort,
  layoutChange,
} from '../reducers/searchQueryReducer';
import { DashboardQuery, SearchLayout } from '../types';
import { hasFilters } from '../utils';

const updateLocation = debounce((query) => locationService.partial(query, true), 300);

export const useSearchQuery = (defaults: Partial<DashboardQuery>) => {
  const query = useSelector((state: StoreState) => state.searchQuery);
  const dispatch = useDispatch();

  const onQueryChange = (query: string) => {
    dispatch(queryChange(query));
    updateLocation({ query });
  };

  const onCloseSearch = () => {
    locationService.partial(
      {
        search: null,
        folder: null,
        ...defaultQueryParams,
      },
      true
    );
  };

  const onSelectSearchItem = () => {
    dispatch(queryChange(''));
    locationService.partial(
      {
        search: null,
        folder: null,
        ...defaultQueryParams,
      },
      true
    );
  };

  const onTagFilterChange = (tags: string[]) => {
    dispatch(setTags(tags));
    updateLocation({ tag: tags });
  };

  const onDatasourceChange = (datasource?: string) => {
    dispatch(datasourceChange(datasource));
    updateLocation({ datasource });
  };

  const onTagAdd = (tag: string) => {
    dispatch(addTag(tag));
    updateLocation({ tag: [...query.tag, tag] });
  };

  const onClearFilters = () => {
    dispatch(clearFilters());
    updateLocation(defaultQueryParams);
  };

  const onStarredFilterChange = (e: FormEvent<HTMLInputElement>) => {
    const starred = (e.target as HTMLInputElement).checked;
    dispatch(toggleStarred(starred));
    updateLocation({ starred: starred || null });
  };

  const onClearStarred = () => {
    dispatch(removeStarred());
    updateLocation({ starred: null });
  };

  const onSortChange = (sort: SelectableValue | null) => {
    dispatch(toggleSort(sort));
    updateLocation({ sort: sort?.value, layout: SearchLayout.List });
  };

  const onLayoutChange = (layout: SearchLayout) => {
    dispatch(layoutChange(layout));
    if (layout === SearchLayout.Folders) {
      updateLocation({ layout, sort: null });
      return;
    }
    updateLocation({ layout });
  };

  return {
    query,
    hasFilters: hasFilters(query),
    onQueryChange,
    onClearFilters,
    onTagFilterChange,
    onStarredFilterChange,
    onClearStarred,
    onTagAdd,
    onSortChange,
    onLayoutChange,
    onDatasourceChange,
    onCloseSearch,
    onSelectSearchItem,
  };
};

import { debounce } from 'lodash';
import { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { StoreState, useSelector, useDispatch } from 'app/types/store';

import { setDataSourcesSearchQuery, setIsSortAscending } from '../state/reducers';
import { getDataSourcesSearchQuery, getDataSourcesSort } from '../state/selectors';
import { trackDsSearched } from '../tracking';

import { FavoritesCheckbox } from './DataSourcesList';

const ascendingSortValue = 'alpha-asc';
const descendingSortValue = 'alpha-desc';

const sortOptions = [
  // We use this unicode 'en dash' character (U+2013), because it looks nicer
  // than simple dash in this context. This is also used in the response of
  // the `sorting` endpoint, which is used in the search dashboard page.
  { label: 'Sort by A–Z', value: ascendingSortValue },
  { label: 'Sort by Z–A', value: descendingSortValue },
];

export interface DataSourcesListHeaderProps {
  favoritesCheckbox?: FavoritesCheckbox;
}

export function DataSourcesListHeader({ favoritesCheckbox }: DataSourcesListHeaderProps) {
  const dispatch = useDispatch();

  const debouncedTrackSearch = useMemo(
    () =>
      debounce((q) => {
        trackDsSearched({ query: q });
      }, 300),
    []
  );

  const setSearchQuery = useCallback(
    (q: string) => {
      dispatch(setDataSourcesSearchQuery(q));
      if (q) {
        debouncedTrackSearch(q);
      }
    },
    [dispatch, debouncedTrackSearch]
  );
  const searchQuery = useSelector(({ dataSources }: StoreState) => getDataSourcesSearchQuery(dataSources));

  const setSort = useCallback(
    (sort: SelectableValue) => dispatch(setIsSortAscending(sort.value === ascendingSortValue)),
    [dispatch]
  );
  const isSortAscending = useSelector(({ dataSources }: StoreState) => getDataSourcesSort(dataSources));

  const sortPicker = {
    onChange: setSort,
    value: isSortAscending ? ascendingSortValue : descendingSortValue,
    getSortOptions: () => Promise.resolve(sortOptions),
  };

  return (
    <PageActionBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      key="action-bar"
      sortPicker={sortPicker}
      favoritesCheckbox={favoritesCheckbox}
    />
  );
}

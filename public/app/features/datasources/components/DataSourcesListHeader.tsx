import { debounce } from 'lodash';
import { useCallback, useMemo } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import PageActionBar, { type FilterCheckbox } from 'app/core/components/PageActionBar/PageActionBar';
import { type StoreState, useSelector, useDispatch } from 'app/types/store';

import { setDataSourcesSearchQuery, setIsSortAscending } from '../state/reducers';
import { getDataSourcesSearchQuery, getDataSourcesSort } from '../state/selectors';
import { trackDsSearched } from '../tracking';

const ascendingSortValue = 'alpha-asc';
const descendingSortValue = 'alpha-desc';
const ordinalSortValue = 'ordinal';

const sortOptions = [
  // We use this unicode 'en dash' character (U+2013), because it looks nicer
  // than simple dash in this context. This is also used in the response of
  // the `sorting` endpoint, which is used in the search dashboard page.
  { label: 'Sort by A–Z', value: ascendingSortValue },
  { label: 'Sort by Z–A', value: descendingSortValue },
];

export interface DataSourcesListHeaderProps {
  filterCheckbox?: FilterCheckbox;
  sortable: boolean;
}

export function DataSourcesListHeader({ filterCheckbox, sortable }: DataSourcesListHeaderProps) {
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
    (sort: SelectableValue) => {
      // Ordinal order is implicit (it's how the list arrives from the backend),
      // so picking the "Priority" option is a no-op against the ascending flag.
      if (sort.value === ordinalSortValue) {
        return;
      }
      dispatch(setIsSortAscending(sort.value === ascendingSortValue));
    },
    [dispatch]
  );
  const isSortAscending = useSelector(({ dataSources }: StoreState) => getDataSourcesSort(dataSources));

  const sortValue = sortable ? ordinalSortValue : isSortAscending ? ascendingSortValue : descendingSortValue;
  const sortPicker = {
    onChange: setSort,
    value: sortValue,
    getSortOptions: () =>
      Promise.resolve(
        sortable
          ? [{ label: t('data-sources.list.sort-by-priority', 'Priority'), value: ordinalSortValue }]
          : sortOptions
      ),
  };

  return (
    <PageActionBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      key="action-bar"
      sortPicker={sortPicker}
      filterCheckbox={filterCheckbox}
    />
  );
}

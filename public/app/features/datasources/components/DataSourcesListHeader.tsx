import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, FilterInput, InlineField, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { FilterCheckbox } from 'app/core/components/PageActionBar/PageActionBar';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { StoreState, useSelector, useDispatch } from 'app/types/store';

import { type HealthStatus } from '../hooks/useAdvisorHealthStatus';
import { setDataSourcesSearchQuery, setIsSortAscending } from '../state/reducers';
import { getDataSourcesSearchQuery, getDataSourcesSort } from '../state/selectors';
import { trackDsSearched } from '../tracking';

const ascendingSortValue = 'alpha-asc';
const descendingSortValue = 'alpha-desc';

const sortOptions = [
  // We use this unicode 'en dash' character (U+2013), because it looks nicer
  // than simple dash in this context. This is also used in the response of
  // the `sorting` endpoint, which is used in the search dashboard page.
  { label: 'Sort by A–Z', value: ascendingSortValue },
  { label: 'Sort by Z–A', value: descendingSortValue },
];

export type HealthFilter = HealthStatus | 'all';

export interface DataSourcesListHeaderProps {
  filterCheckbox?: FilterCheckbox;
  healthFilter?: HealthFilter;
  onHealthFilterChange?: (value: HealthFilter) => void;
}

export function DataSourcesListHeader({
  filterCheckbox,
  healthFilter,
  onHealthFilterChange,
}: DataSourcesListHeaderProps) {
  const dispatch = useDispatch();
  const styles = useStyles2(getHeaderStyles);
  const healthFilterOptions: Array<SelectableValue<HealthFilter>> = useMemo(
    () => [
      { label: t('datasources.health-filter.all', 'All'), value: 'all' },
      { label: t('datasources.health-filter.healthy', 'Healthy'), value: 'healthy' },
      { label: t('datasources.health-filter.unhealthy', 'Unhealthy'), value: 'unhealthy' },
    ],
    []
  );

  const debouncedTrackSearch = useMemo(
    () =>
      debounce((q) => {
        trackDsSearched({ query: q });
      }, 300),
    []
  );

  useEffect(() => () => debouncedTrackSearch.cancel(), [debouncedTrackSearch]);

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

  return (
    <div className={styles.container}>
      <InlineField grow>
        <FilterInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('datasources.list-header.search-placeholder', 'Search by name or type')}
        />
      </InlineField>
      {filterCheckbox && (
        <Checkbox
          label={filterCheckbox.label}
          value={filterCheckbox.value}
          onChange={(event) => filterCheckbox.onChange(event.currentTarget.checked)}
        />
      )}
      {healthFilter !== undefined && onHealthFilterChange && (
        <RadioButtonGroup options={healthFilterOptions} value={healthFilter} onChange={onHealthFilterChange} />
      )}
      <SortPicker
        onChange={setSort}
        value={isSortAscending ? ascendingSortValue : descendingSortValue}
        getSortOptions={() => Promise.resolve(sortOptions)}
      />
    </div>
  );
}

const getHeaderStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }),
});

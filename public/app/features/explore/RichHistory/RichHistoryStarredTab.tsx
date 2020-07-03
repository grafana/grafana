import React, { useState, useEffect, useCallback } from 'react';
import { css } from 'emotion';
import { uniqBy, debounce } from 'lodash';

// Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

// Utils
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';

import { SortOrder } from '../../../core/utils/explore';
import { filterAndSortQueries, createDatasourcesList } from '../../../core/utils/richHistory';

// Components
import RichHistoryCard from './RichHistoryCard';
import { sortOrderOptions } from './RichHistory';
import { Select } from '@grafana/ui';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

export interface Props {
  queries: RichHistoryQuery[];
  sortOrder: SortOrder;
  activeDatasourceOnly: boolean;
  datasourceFilters: SelectableValue[] | null;
  exploreId: ExploreId;
  onChangeSortOrder: (sortOrder: SortOrder) => void;
  onSelectDatasourceFilters: (value: SelectableValue[] | null) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = theme.isLight ? theme.palette.gray5 : theme.palette.dark4;
  return {
    container: css`
      display: flex;
    `,
    containerContent: css`
      width: 100%;
    `,
    selectors: css`
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    `,
    multiselect: css`
      width: 100%;
      margin-bottom: ${theme.spacing.sm};
      .gf-form-select-box__multi-value {
        background-color: ${bgColor};
        padding: ${theme.spacing.xxs} ${theme.spacing.xs} ${theme.spacing.xxs} ${theme.spacing.sm};
        border-radius: ${theme.border.radius.sm};
      }
    `,
    filterInput: css`
      margin-bottom: ${theme.spacing.sm};
    `,
    sort: css`
      width: 170px;
    `,
    footer: css`
      height: 60px;
      margin-top: ${theme.spacing.lg};
      display: flex;
      justify-content: center;
      font-weight: ${theme.typography.weight.light};
      font-size: ${theme.typography.size.sm};
      a {
        font-weight: ${theme.typography.weight.semibold};
        margin-left: ${theme.spacing.xxs};
      }
    `,
  };
});

export function RichHistoryStarredTab(props: Props) {
  const {
    datasourceFilters,
    onSelectDatasourceFilters,
    queries,
    onChangeSortOrder,
    sortOrder,
    activeDatasourceOnly,
    exploreId,
  } = props;

  const [filteredQueries, setFilteredQueries] = useState<RichHistoryQuery[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const theme = useTheme();
  const styles = getStyles(theme);

  const datasourcesRetrievedFromQueryHistory = uniqBy(queries, 'datasourceName').map(d => d.datasourceName);
  const listOfDatasources = createDatasourcesList(datasourcesRetrievedFromQueryHistory);
  const starredQueries = queries.filter(q => q.starred === true);

  const filterAndSortQueriesDebounced = useCallback(
    debounce((searchValue: string) => {
      setFilteredQueries(
        filterAndSortQueries(
          starredQueries,
          sortOrder,
          datasourceFilters?.map(d => d.value) as string[] | null,
          searchValue
        )
      );
    }, 300),
    [queries, sortOrder, datasourceFilters]
  );

  useEffect(() => {
    setFilteredQueries(
      filterAndSortQueries(
        starredQueries,
        sortOrder,
        datasourceFilters?.map(d => d.value) as string[] | null,
        searchInput
      )
    );
  }, [queries, sortOrder, datasourceFilters]);

  return (
    <div className={styles.container}>
      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!activeDatasourceOnly && (
            <div aria-label="Filter datasources" className={styles.multiselect}>
              <Select
                isMulti={true}
                options={listOfDatasources}
                value={datasourceFilters}
                placeholder="Filter queries for specific data sources(s)"
                onChange={onSelectDatasourceFilters}
              />
            </div>
          )}
          <div className={styles.filterInput}>
            <FilterInput
              labelClassName="gf-form--has-input-icon gf-form--grow"
              inputClassName="gf-form-input"
              placeholder="Search queries"
              value={searchInput}
              onChange={(value: string) => {
                setSearchInput(value);
                filterAndSortQueriesDebounced(value);
              }}
            />
          </div>
          <div aria-label="Sort queries" className={styles.sort}>
            <Select
              options={sortOrderOptions}
              value={sortOrderOptions.filter(order => order.value === sortOrder)}
              placeholder="Sort queries by"
              onChange={e => onChangeSortOrder(e.value as SortOrder)}
            />
          </div>
        </div>
        {filteredQueries.map(q => {
          const idx = listOfDatasources.findIndex(d => d.label === q.datasourceName);
          return (
            <RichHistoryCard
              query={q}
              key={q.ts}
              exploreId={exploreId}
              dsImg={listOfDatasources[idx].imgUrl}
              isRemoved={listOfDatasources[idx].isRemoved}
            />
          );
        })}
        <div className={styles.footer}>The history is local to your browser and is not shared with others.</div>
      </div>
    </div>
  );
}

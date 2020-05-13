import React from 'react';
import { css } from 'emotion';
import { uniqBy } from 'lodash';

// Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

// Utils
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';

import { SortOrder } from '../../../core/utils/explore';
import { sortQueries, createDatasourcesList } from '../../../core/utils/richHistory';

// Components
import RichHistoryCard from './RichHistoryCard';
import { sortOrderOptions } from './RichHistory';
import { Select } from '@grafana/ui';

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
    `,
    multiselect: css`
      width: 60%;
      .gf-form-select-box__multi-value {
        background-color: ${bgColor};
        padding: ${theme.spacing.xxs} ${theme.spacing.xs} ${theme.spacing.xxs} ${theme.spacing.sm};
        border-radius: ${theme.border.radius.sm};
      }
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

  const theme = useTheme();
  const styles = getStyles(theme);

  const datasourcesRetrievedFromQueryHistory = uniqBy(queries, 'datasourceName').map(d => d.datasourceName);
  const listOfDatasources = createDatasourcesList(datasourcesRetrievedFromQueryHistory);

  const listOfDatasourceFilters = datasourceFilters?.map(d => d.value);

  const starredQueries = queries.filter(q => q.starred === true);
  const starredQueriesFilteredByDatasource =
    listOfDatasourceFilters && listOfDatasourceFilters?.length > 0
      ? starredQueries?.filter(q => listOfDatasourceFilters?.includes(q.datasourceName))
      : starredQueries;

  const sortedStarredQueries = sortQueries(starredQueriesFilteredByDatasource, sortOrder);

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
          <div aria-label="Sort queries" className={styles.sort}>
            <Select
              options={sortOrderOptions}
              value={sortOrderOptions.filter(order => order.value === sortOrder)}
              placeholder="Sort queries by"
              onChange={e => onChangeSortOrder(e.value as SortOrder)}
            />
          </div>
        </div>
        {sortedStarredQueries.map(q => {
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

import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2, Select, MultiSelect, FilterInput, Button } from '@grafana/ui';
import {
  createDatasourcesList,
  SortOrder,
  RichHistorySearchFilters,
  RichHistorySettings,
} from 'app/core/utils/richHistory';
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

import { getSortOrderOptions } from './RichHistory';
import RichHistoryCard from './RichHistoryCard';

export interface RichHistoryStarredTabProps {
  queries: RichHistoryQuery[];
  totalQueries: number;
  loading: boolean;
  activeDatasourceInstance: string;
  updateFilters: (filtersToUpdate: Partial<RichHistorySearchFilters>) => void;
  clearRichHistoryResults: () => void;
  loadMoreRichHistory: () => void;
  richHistorySearchFilters?: RichHistorySearchFilters;
  richHistorySettings: RichHistorySettings;
  exploreId: ExploreId;
}

const getStyles = (theme: GrafanaTheme2) => {
  const bgColor = theme.isLight ? theme.v1.palette.gray5 : theme.v1.palette.dark4;
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
      margin-bottom: ${theme.spacing(1)};
      .gf-form-select-box__multi-value {
        background-color: ${bgColor};
        padding: ${theme.spacing(0.25, 0.5, 0.25, 1)};
        border-radius: ${theme.shape.borderRadius(1)};
      }
    `,
    filterInput: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    sort: css`
      width: 170px;
    `,
    footer: css`
      height: 60px;
      margin-top: ${theme.spacing(3)};
      display: flex;
      justify-content: center;
      font-weight: ${theme.typography.fontWeightLight};
      font-size: ${theme.typography.bodySmall.fontSize};
      a {
        font-weight: ${theme.typography.fontWeightMedium};
        margin-left: ${theme.spacing(0.25)};
      }
    `,
  };
};

export function RichHistoryStarredTab(props: RichHistoryStarredTabProps) {
  const {
    updateFilters,
    clearRichHistoryResults,
    loadMoreRichHistory,
    activeDatasourceInstance,
    richHistorySettings,
    queries,
    totalQueries,
    loading,
    richHistorySearchFilters,
    exploreId,
  } = props;

  const styles = useStyles2(getStyles);

  const listOfDatasources = createDatasourcesList();

  useEffect(() => {
    const datasourceFilters =
      richHistorySettings.activeDatasourceOnly && richHistorySettings.lastUsedDatasourceFilters
        ? richHistorySettings.lastUsedDatasourceFilters
        : [activeDatasourceInstance];
    const filters: RichHistorySearchFilters = {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters,
      from: 0,
      to: richHistorySettings.retentionPeriod,
      starred: true,
    };
    updateFilters(filters);
    return () => {
      clearRichHistoryResults();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!richHistorySearchFilters) {
    return <span>Loading...</span>;
  }

  const sortOrderOptions = getSortOrderOptions();

  return (
    <div className={styles.container}>
      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!richHistorySettings.activeDatasourceOnly && (
            <MultiSelect
              className={styles.multiselect}
              options={listOfDatasources.map((ds) => {
                return { value: ds.name, label: ds.name };
              })}
              value={richHistorySearchFilters.datasourceFilters}
              placeholder="Filter queries for data sources(s)"
              aria-label="Filter queries for data sources(s)"
              onChange={(options: SelectableValue[]) => {
                updateFilters({ datasourceFilters: options.map((option) => option.value) });
              }}
            />
          )}
          <div className={styles.filterInput}>
            <FilterInput
              escapeRegex={false}
              placeholder="Search queries"
              value={richHistorySearchFilters.search}
              onChange={(search: string) => updateFilters({ search })}
            />
          </div>
          <div aria-label="Sort queries" className={styles.sort}>
            <Select
              value={sortOrderOptions.filter((order) => order.value === richHistorySearchFilters.sortOrder)}
              options={sortOrderOptions}
              placeholder="Sort queries by"
              onChange={(e: SelectableValue<SortOrder>) => updateFilters({ sortOrder: e.value })}
            />
          </div>
        </div>
        {loading && <span>Loading results...</span>}
        {!loading &&
          queries.map((q) => {
            return <RichHistoryCard query={q} key={q.id} exploreId={exploreId} />;
          })}
        {queries.length && queries.length !== totalQueries ? (
          <div>
            Showing {queries.length} of {totalQueries} <Button onClick={loadMoreRichHistory}>Load more</Button>
          </div>
        ) : null}
        <div className={styles.footer}>
          {!config.queryHistoryEnabled ? 'The history is local to your browser and is not shared with others.' : ''}
        </div>
      </div>
    </div>
  );
}

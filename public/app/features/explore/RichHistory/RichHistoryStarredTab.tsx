import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2, Select, MultiSelect, FilterInput, Button } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import {
  createDatasourcesList,
  SortOrder,
  RichHistorySearchFilters,
  RichHistorySettings,
} from 'app/core/utils/richHistory';
import { RichHistoryQuery } from 'app/types/explore';

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
  exploreId: string;
}

const getStyles = (theme: GrafanaTheme2) => {
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
    `,
    filterInput: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    sort: css`
      width: 170px;
    `,
    footer: css`
      height: 60px;
      display: flex;
      justify-content: center;
      align-items: center;
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
    return (
      <span>
        <Trans i18nKey="explore.rich-history-starred-tab.loading">Loading...</Trans>;
      </span>
    );
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
              placeholder={t(
                'explore.rich-history-starred-tab.filter-queries-placeholder',
                'Filter queries for data sources(s)'
              )}
              aria-label={t(
                'explore.rich-history-starred-tab.filter-queries-aria-label',
                'Filter queries for data sources(s)'
              )}
              onChange={(options: SelectableValue[]) => {
                updateFilters({ datasourceFilters: options.map((option) => option.value) });
              }}
            />
          )}
          <div className={styles.filterInput}>
            <FilterInput
              escapeRegex={false}
              placeholder={t('explore.rich-history-starred-tab.search-queries-placeholder', 'Search queries')}
              value={richHistorySearchFilters.search}
              onChange={(search: string) => updateFilters({ search })}
            />
          </div>
          <div
            aria-label={t('explore.rich-history-starred-tab.sort-queries-aria-label', 'Sort queries')}
            className={styles.sort}
          >
            <Select
              value={sortOrderOptions.filter((order) => order.value === richHistorySearchFilters.sortOrder)}
              options={sortOrderOptions}
              placeholder={t('explore.rich-history-starred-tab.sort-queries-placeholder', 'Sort queries by')}
              onChange={(e: SelectableValue<SortOrder>) => updateFilters({ sortOrder: e.value })}
            />
          </div>
        </div>
        {loading && (
          <span>
            <Trans i18nKey="explore.rich-history-starred-tab.loading-results">Loading results...</Trans>
          </span>
        )}
        {!loading &&
          queries.map((q) => {
            return <RichHistoryCard queryHistoryItem={q} key={q.id} exploreId={exploreId} />;
          })}
        {queries.length && queries.length !== totalQueries ? (
          <div>
            <Trans
              i18nKey="explore.rich-history-starred-tab.showing-queries"
              defaults="Showing {{ shown }} of {{ total }} <0>Load more</0>"
              values={{ shown: queries.length, total: totalQueries }}
              components={[
                <Button onClick={loadMoreRichHistory} key="loadMoreButton">
                  Load more
                </Button>,
              ]}
            />
          </div>
        ) : null}
        <div className={styles.footer}>
          {!config.queryHistoryEnabled
            ? t(
                'explore.rich-history-starred-tab.local-history-message',
                'The history is local to your browser and is not shared with others.'
              )
            : ''}
        </div>
      </div>
    </div>
  );
}

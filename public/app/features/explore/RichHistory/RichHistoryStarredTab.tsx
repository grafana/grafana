import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { DataSourceApi, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { useStyles2, Select, MultiSelect, FilterInput, Button } from '@grafana/ui';
import {
  createDatasourcesList,
  SortOrder,
  RichHistorySearchFilters,
  RichHistorySettings,
} from 'app/core/utils/richHistory';
import { RichHistoryQuery } from 'app/types/explore';
import { useSelector } from 'app/types/store';

import { selectExploreDSMaps } from '../state/selectors';

import { getSortOrderOptions } from './RichHistory';
import RichHistoryCard from './RichHistoryCard';

export interface RichHistoryStarredTabProps {
  queries: RichHistoryQuery[];
  totalQueries: number;
  loading: boolean;
  updateFilters: (filtersToUpdate: Partial<RichHistorySearchFilters>) => void;
  clearRichHistoryResults: () => void;
  loadMoreRichHistory: () => void;
  richHistorySearchFilters?: RichHistorySearchFilters;
  richHistorySettings: RichHistorySettings;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
    }),
    containerContent: css({
      width: '100%',
    }),
    selectors: css({
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    }),
    multiselect: css({
      width: '100%',
      marginBottom: theme.spacing(1),
    }),
    filterInput: css({
      marginBottom: theme.spacing(1),
    }),
    sort: css({
      width: '170px',
    }),
    footer: css({
      height: '60px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontWeight: theme.typography.fontWeightLight,
      fontSize: theme.typography.bodySmall.fontSize,
      a: {
        fontWeight: theme.typography.fontWeightMedium,
        marginLeft: theme.spacing(0.25),
      },
    }),
  };
};

export function RichHistoryStarredTab(props: RichHistoryStarredTabProps) {
  const {
    updateFilters,
    clearRichHistoryResults,
    loadMoreRichHistory,
    richHistorySettings,
    queries,
    totalQueries,
    loading,
    richHistorySearchFilters,
  } = props;

  const styles = useStyles2(getStyles);
  const exploreActiveDS = useSelector(selectExploreDSMaps);

  const listOfDatasources = createDatasourcesList();

  useEffect(() => {
    const datasourceFilters =
      richHistorySettings.activeDatasourcesOnly && richHistorySettings.lastUsedDatasourceFilters
        ? richHistorySettings.lastUsedDatasourceFilters
        : exploreActiveDS.dsToExplore
            .map((eDs) => listOfDatasources.find((ds) => ds.uid === eDs.datasource?.uid)?.name)
            .filter((name): name is string => !!name);
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

  const { value: datasourceFilterApis, loading: loadingDs } = useAsync(async () => {
    const datasourcesToGet =
      richHistorySearchFilters?.datasourceFilters && richHistorySearchFilters?.datasourceFilters.length > 0
        ? richHistorySearchFilters?.datasourceFilters
        : listOfDatasources.map((ds) => ds.uid);
    const dsGetProm = await datasourcesToGet.map(async (dsf) => {
      try {
        // this get works off datasource names
        return getDataSourceSrv().get(dsf);
      } catch (e) {
        return Promise.resolve();
      }
    });

    if (dsGetProm !== undefined) {
      const enhancedDatasourceData = (await Promise.all(dsGetProm)).filter((dsi): dsi is DataSourceApi => !!dsi);
      //setDatasourceFilterApiList(enhancedDatasourceData)
      return enhancedDatasourceData;
    } else {
      return [];
    }
  }, [richHistorySearchFilters?.datasourceFilters]);

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
          {!richHistorySettings.activeDatasourcesOnly && (
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
        {loading && loadingDs && (
          <span>
            <Trans i18nKey="explore.rich-history-starred-tab.loading-results">Loading results...</Trans>
          </span>
        )}
        {!(loading && loadingDs) &&
          queries.map((q) => {
            return <RichHistoryCard queryHistoryItem={q} key={q.id} datasourceInstances={datasourceFilterApis} />;
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

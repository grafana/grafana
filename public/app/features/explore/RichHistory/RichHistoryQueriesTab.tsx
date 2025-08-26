import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { DataSourceApi, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Button, FilterInput, MultiSelect, RangeSlider, Select, useStyles2 } from '@grafana/ui';
import {
  mapNumbertoTimeInSlider,
  mapQueriesToHeadings,
  SortOrder,
  RichHistorySearchFilters,
  RichHistorySettings,
} from 'app/core/utils/richHistory';
import { RichHistoryQuery } from 'app/types/explore';

import { getSortOrderOptions } from './RichHistory';
import RichHistoryCard from './RichHistoryCard';

export interface RichHistoryQueriesTabProps {
  queries: RichHistoryQuery[];
  totalQueries: number;
  loading: boolean;
  updateFilters: (filtersToUpdate?: Partial<RichHistorySearchFilters>) => void;
  clearRichHistoryResults: () => void;
  loadMoreRichHistory: () => void;
  richHistorySettings: RichHistorySettings;
  richHistorySearchFilters?: RichHistorySearchFilters;
  activeDatasources: string[];
  listOfDatasources: Array<{ name: string; uid: string }>;
  height: number;
}

const getStyles = (theme: GrafanaTheme2, height: number) => {
  return {
    container: css({
      display: 'flex',
    }),
    labelSlider: css({
      fontSize: theme.typography.bodySmall.fontSize,
      '&:last-of-type': {
        marginTop: theme.spacing(3),
      },
      '&:first-of-type': {
        fontWeight: theme.typography.fontWeightMedium,
        marginBottom: theme.spacing(2),
      },
    }),
    containerContent: css({
      /* 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab */
      width: 'calc(100% - 134px)',
    }),
    containerSlider: css({
      width: '129px',
      marginRight: theme.spacing(1),
    }),
    fixedSlider: css({
      position: 'fixed',
    }),
    slider: css({
      bottom: '10px',
      height: `${height - 180}px`,
      width: '129px',
      padding: theme.spacing(1, 0),
    }),
    selectors: css({
      display: 'flex',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    }),
    filterInput: css({
      marginBottom: theme.spacing(1),
    }),
    multiselect: css({
      width: '100%',
      marginBottom: theme.spacing(1),
    }),
    sort: css({
      width: '170px',
    }),
    sessionName: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      marginTop: theme.spacing(3),
      h4: {
        margin: '0 10px 0 0',
      },
    }),
    heading: css({
      fontSize: theme.typography.h4.fontSize,
      margin: theme.spacing(2, 0.25, 1, 0.25),
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
    queries: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightRegular,
      marginLeft: theme.spacing(0.5),
    }),
  };
};

export function RichHistoryQueriesTab(props: RichHistoryQueriesTabProps) {
  const {
    queries,
    totalQueries,
    loading,
    richHistorySearchFilters,
    updateFilters,
    clearRichHistoryResults,
    loadMoreRichHistory,
    richHistorySettings,
    height,
    listOfDatasources,
    activeDatasources,
  } = props;

  const styles = useStyles2(getStyles, height);

  // on mount, set filter to either active datasource or all datasources
  useEffect(() => {
    const datasourceFilters =
      !richHistorySettings.activeDatasourcesOnly && richHistorySettings.lastUsedDatasourceFilters
        ? richHistorySettings.lastUsedDatasourceFilters
        : activeDatasources;
    const filters: RichHistorySearchFilters = {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters,
      from: 0,
      to: richHistorySettings.retentionPeriod,
      starred: false,
    };
    updateFilters(filters);

    return () => {
      clearRichHistoryResults();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { value: datasourceFilterApis, loading: loadingDs } = useAsync(async () => {
    const datasourcesToGet = listOfDatasources.map((ds) => ds.uid);
    const dsGetProm = datasourcesToGet.map(async (dsf) => {
      try {
        // this get works off datasource names
        return getDataSourceSrv().get(dsf);
      } catch (e) {
        return Promise.resolve();
      }
    });

    if (dsGetProm !== undefined) {
      const enhancedDatasourceData = (await Promise.all(dsGetProm)).filter((dsi): dsi is DataSourceApi => !!dsi);
      return enhancedDatasourceData;
    } else {
      return [];
    }
  }, [richHistorySearchFilters?.datasourceFilters]);

  if (!richHistorySearchFilters) {
    return (
      <span>
        <Trans i18nKey="explore.rich-history-queries-tab.loading">Loading...</Trans>
      </span>
    );
  }

  /* mappedQueriesToHeadings is an object where query headings (stringified dates/data sources)
   * are keys and arrays with queries that belong to that headings are values.
   */
  const mappedQueriesToHeadings = mapQueriesToHeadings(queries, richHistorySearchFilters.sortOrder);
  const sortOrderOptions = getSortOrderOptions();
  const partialResults = queries.length && queries.length !== totalQueries;
  const timeFilter = [
    richHistorySearchFilters.from || 0,
    richHistorySearchFilters.to || richHistorySettings.retentionPeriod,
  ];

  return (
    <div className={styles.container}>
      <div className={styles.containerSlider}>
        <div className={styles.fixedSlider}>
          <div className={styles.labelSlider}>
            <Trans i18nKey="explore.rich-history-queries-tab.filter-history">Filter history</Trans>
          </div>
          <div className={styles.labelSlider}>{mapNumbertoTimeInSlider(timeFilter[0])}</div>
          <div className={styles.slider}>
            <RangeSlider
              tooltipAlwaysVisible={false}
              min={0}
              max={richHistorySettings.retentionPeriod}
              value={timeFilter}
              orientation="vertical"
              formatTooltipResult={mapNumbertoTimeInSlider}
              reverse={true}
              onAfterChange={(value) => {
                updateFilters({ from: value![0], to: value![1] });
              }}
            />
          </div>
          <div className={styles.labelSlider}>{mapNumbertoTimeInSlider(timeFilter[1])}</div>
        </div>
      </div>

      <div className={styles.containerContent} data-testid="query-history-queries-tab">
        <div className={styles.selectors}>
          {!richHistorySettings.activeDatasourcesOnly && (
            <MultiSelect
              className={styles.multiselect}
              options={listOfDatasources.map((ds) => {
                return { value: ds.name, label: ds.name };
              })}
              value={richHistorySearchFilters.datasourceFilters}
              placeholder={t(
                'explore.rich-history-queries-tab.filter-placeholder',
                'Filter queries for data sources(s)'
              )}
              aria-label={t('explore.rich-history-queries-tab.filter-aria-label', 'Filter queries for data sources(s)')}
              onChange={(options: SelectableValue[]) => {
                updateFilters({ datasourceFilters: options.map((option) => option.value) });
              }}
            />
          )}
          <div className={styles.filterInput}>
            <FilterInput
              escapeRegex={false}
              placeholder={t('explore.rich-history-queries-tab.search-placeholder', 'Search queries')}
              value={richHistorySearchFilters.search}
              onChange={(search: string) => updateFilters({ search })}
            />
          </div>
          <div
            aria-label={t('explore.rich-history-queries-tab.sort-aria-label', 'Sort queries')}
            className={styles.sort}
          >
            <Select
              value={sortOrderOptions.filter((order) => order.value === richHistorySearchFilters.sortOrder)}
              options={sortOrderOptions}
              placeholder={t('explore.rich-history-queries-tab.sort-placeholder', 'Sort queries by')}
              onChange={(e: SelectableValue<SortOrder>) => updateFilters({ sortOrder: e.value })}
            />
          </div>
        </div>

        {(loading || loadingDs) && (
          <span>
            <Trans i18nKey="explore.rich-history-queries-tab.loading-results">Loading results...</Trans>
          </span>
        )}

        {!(loading || loadingDs) &&
          Object.keys(mappedQueriesToHeadings).map((heading) => {
            return (
              <div key={heading}>
                <div className={styles.heading}>
                  {heading}{' '}
                  <span className={styles.queries}>
                    {partialResults ? (
                      <Trans
                        i18nKey="explore.rich-history-queries-tab.displaying-partial-queries"
                        defaults="Displaying {{ count }} queries"
                        values={{ count: mappedQueriesToHeadings[heading].length }}
                      />
                    ) : (
                      <Trans
                        i18nKey="explore.rich-history-queries-tab.displaying-queries"
                        defaults="{{ count }} queries"
                        values={{ count: mappedQueriesToHeadings[heading].length }}
                      />
                    )}
                  </span>
                </div>
                {mappedQueriesToHeadings[heading].map((q) => {
                  return <RichHistoryCard datasourceInstances={datasourceFilterApis} queryHistoryItem={q} key={q.id} />;
                })}
              </div>
            );
          })}
        {partialResults ? (
          <div>
            <Trans
              i18nKey="explore.rich-history-queries-tab.showing-queries"
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
                'explore.rich-history-queries-tab.history-local',
                'The history is local to your browser and is not shared with others.'
              )
            : ''}
        </div>
      </div>
    </div>
  );
}

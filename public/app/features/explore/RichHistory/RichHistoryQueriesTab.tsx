import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, FilterInput, MultiSelect, RangeSlider, Select, stylesFactory, useTheme } from '@grafana/ui';
import {
  createDatasourcesList,
  mapNumbertoTimeInSlider,
  mapQueriesToHeadings,
  SortOrder,
  RichHistorySearchFilters,
  RichHistorySettings,
} from 'app/core/utils/richHistory';
import { ExploreId, RichHistoryQuery } from 'app/types/explore';

import { getSortOrderOptions } from './RichHistory';
import RichHistoryCard from './RichHistoryCard';

export interface Props {
  queries: RichHistoryQuery[];
  totalQueries: number;
  loading: boolean;
  activeDatasourceInstance: string;
  updateFilters: (filtersToUpdate?: Partial<RichHistorySearchFilters>) => void;
  clearRichHistoryResults: () => void;
  loadMoreRichHistory: () => void;
  richHistorySettings: RichHistorySettings;
  richHistorySearchFilters?: RichHistorySearchFilters;
  exploreId: ExploreId;
  height: number;
}

const getStyles = stylesFactory((theme: GrafanaTheme, height: number) => {
  const bgColor = theme.isLight ? theme.palette.gray5 : theme.palette.dark4;

  /* 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab */
  const cardWidth = '100% - 134px';
  const sliderHeight = `${height - 180}px`;
  return {
    container: css`
      display: flex;
      .label-slider {
        font-size: ${theme.typography.size.sm};
        &:last-of-type {
          margin-top: ${theme.spacing.lg};
        }
        &:first-of-type {
          font-weight: ${theme.typography.weight.semibold};
          margin-bottom: ${theme.spacing.md};
        }
      }
    `,
    containerContent: css`
      width: calc(${cardWidth});
    `,
    containerSlider: css`
      width: 129px;
      margin-right: ${theme.spacing.sm};
      .slider {
        bottom: 10px;
        height: ${sliderHeight};
        width: 129px;
        padding: ${theme.spacing.sm} 0;
      }
    `,
    slider: css`
      position: fixed;
    `,
    selectors: css`
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    `,
    filterInput: css`
      margin-bottom: ${theme.spacing.sm};
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
    sort: css`
      width: 170px;
    `,
    sessionName: css`
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin-top: ${theme.spacing.lg};
      h4 {
        margin: 0 10px 0 0;
      }
    `,
    heading: css`
      font-size: ${theme.typography.heading.h4};
      margin: ${theme.spacing.md} ${theme.spacing.xxs} ${theme.spacing.sm} ${theme.spacing.xxs};
    `,
    footer: css`
      height: 60px;
      margin: ${theme.spacing.lg} auto;
      display: flex;
      justify-content: center;
      font-weight: ${theme.typography.weight.light};
      font-size: ${theme.typography.size.sm};
      a {
        font-weight: ${theme.typography.weight.semibold};
        margin-left: ${theme.spacing.xxs};
      }
    `,
    queries: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.regular};
      margin-left: ${theme.spacing.xs};
    `,
  };
});

export function RichHistoryQueriesTab(props: Props) {
  const {
    queries,
    totalQueries,
    loading,
    richHistorySearchFilters,
    updateFilters,
    clearRichHistoryResults,
    loadMoreRichHistory,
    richHistorySettings,
    exploreId,
    height,
    activeDatasourceInstance,
  } = props;

  const theme = useTheme();
  const styles = getStyles(theme, height);

  const listOfDatasources = createDatasourcesList();

  useEffect(() => {
    const datasourceFilters =
      !richHistorySettings.activeDatasourceOnly && richHistorySettings.lastUsedDatasourceFilters
        ? richHistorySettings.lastUsedDatasourceFilters
        : [activeDatasourceInstance];
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

  if (!richHistorySearchFilters) {
    return <span>Loading...</span>;
  }

  /* mappedQueriesToHeadings is an object where query headings (stringified dates/data sources)
   * are keys and arrays with queries that belong to that headings are values.
   */
  const mappedQueriesToHeadings = mapQueriesToHeadings(queries, richHistorySearchFilters.sortOrder);
  const sortOrderOptions = getSortOrderOptions();
  const partialResults = queries.length && queries.length !== totalQueries;

  return (
    <div className={styles.container}>
      <div className={styles.containerSlider}>
        <div className={styles.slider}>
          <div className="label-slider">Filter history</div>
          <div className="label-slider">{mapNumbertoTimeInSlider(richHistorySearchFilters.from)}</div>
          <div className="slider">
            <RangeSlider
              tooltipAlwaysVisible={false}
              min={0}
              max={richHistorySettings.retentionPeriod}
              value={[richHistorySearchFilters.from, richHistorySearchFilters.to]}
              orientation="vertical"
              formatTooltipResult={mapNumbertoTimeInSlider}
              reverse={true}
              onAfterChange={(value) => {
                updateFilters({ from: value![0], to: value![1] });
              }}
            />
          </div>
          <div className="label-slider">{mapNumbertoTimeInSlider(richHistorySearchFilters.to)}</div>
        </div>
      </div>

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
          Object.keys(mappedQueriesToHeadings).map((heading) => {
            return (
              <div key={heading}>
                <div className={styles.heading}>
                  {heading}{' '}
                  <span className={styles.queries}>
                    {partialResults ? 'Displaying ' : ''}
                    {mappedQueriesToHeadings[heading].length} queries
                  </span>
                </div>
                {mappedQueriesToHeadings[heading].map((q: RichHistoryQuery) => {
                  const idx = listOfDatasources.findIndex((d) => d.name === q.datasourceName);
                  return (
                    <RichHistoryCard
                      query={q}
                      key={q.id}
                      exploreId={exploreId}
                      dsImg={idx === -1 ? 'public/img/icn-datasource.svg' : listOfDatasources[idx].imgUrl}
                      isRemoved={idx === -1}
                    />
                  );
                })}
              </div>
            );
          })}
        {partialResults ? (
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

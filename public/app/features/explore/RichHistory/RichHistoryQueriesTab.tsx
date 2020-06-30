import React, { useState, useEffect, useCallback } from 'react';
import { css } from 'emotion';
import { uniqBy, debounce } from 'lodash';

// Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

// Utils
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';

import { SortOrder } from 'app/core/utils/explore';
import {
  mapNumbertoTimeInSlider,
  mapQueriesToHeadings,
  createDatasourcesList,
  filterAndSortQueries,
} from 'app/core/utils/richHistory';

// Components
import RichHistoryCard from './RichHistoryCard';
import { sortOrderOptions } from './RichHistory';
import { Slider, Select } from '@grafana/ui';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

export interface Props {
  queries: RichHistoryQuery[];
  sortOrder: SortOrder;
  activeDatasourceOnly: boolean;
  datasourceFilters: SelectableValue[] | null;
  retentionPeriod: number;
  exploreId: ExploreId;
  height: number;
  onChangeSortOrder: (sortOrder: SortOrder) => void;
  onSelectDatasourceFilters: (value: SelectableValue[] | null) => void;
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
    queries: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.regular};
      margin-left: ${theme.spacing.xs};
    `,
  };
});

export function RichHistoryQueriesTab(props: Props) {
  const {
    datasourceFilters,
    onSelectDatasourceFilters,
    queries,
    onChangeSortOrder,
    sortOrder,
    activeDatasourceOnly,
    retentionPeriod,
    exploreId,
    height,
  } = props;

  const [timeFilter, setTimeFilter] = useState<[number, number]>([0, retentionPeriod]);
  const [filteredQueries, setFilteredQueries] = useState<RichHistoryQuery[]>([]);
  const [searchInput, setSearchInput] = useState('');

  const theme = useTheme();
  const styles = getStyles(theme, height);

  const datasourcesRetrievedFromQueryHistory = uniqBy(queries, 'datasourceName').map(d => d.datasourceName);
  const listOfDatasources = createDatasourcesList(datasourcesRetrievedFromQueryHistory);

  const filterAndSortQueriesDebounced = useCallback(
    debounce((searchValue: string) => {
      setFilteredQueries(
        filterAndSortQueries(
          queries,
          sortOrder,
          datasourceFilters?.map(d => d.value) as string[] | null,
          searchValue,
          timeFilter
        )
      );
    }, 300),
    [timeFilter, queries, sortOrder, datasourceFilters]
  );

  useEffect(() => {
    setFilteredQueries(
      filterAndSortQueries(
        queries,
        sortOrder,
        datasourceFilters?.map(d => d.value) as string[] | null,
        searchInput,
        timeFilter
      )
    );
  }, [timeFilter, queries, sortOrder, datasourceFilters]);

  /* mappedQueriesToHeadings is an object where query headings (stringified dates/data sources)
   * are keys and arrays with queries that belong to that headings are values.
   */
  const mappedQueriesToHeadings = mapQueriesToHeadings(filteredQueries, sortOrder);

  return (
    <div className={styles.container}>
      <div className={styles.containerSlider}>
        <div className={styles.slider}>
          <div className="label-slider">Filter history</div>
          <div className="label-slider">{mapNumbertoTimeInSlider(timeFilter[0])}</div>
          <div className="slider">
            <Slider
              tooltipAlwaysVisible={false}
              min={0}
              max={retentionPeriod}
              value={timeFilter}
              orientation="vertical"
              formatTooltipResult={mapNumbertoTimeInSlider}
              reverse={true}
              onAfterChange={setTimeFilter as () => number[]}
            />
          </div>
          <div className="label-slider">{mapNumbertoTimeInSlider(timeFilter[1])}</div>
        </div>
      </div>

      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!activeDatasourceOnly && (
            <div aria-label="Filter datasources" className={styles.multiselect}>
              <Select
                isMulti={true}
                options={listOfDatasources}
                value={datasourceFilters}
                placeholder="Filter queries for data sources(s)"
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
              value={sortOrderOptions.filter(order => order.value === sortOrder)}
              options={sortOrderOptions}
              placeholder="Sort queries by"
              onChange={e => onChangeSortOrder(e.value as SortOrder)}
            />
          </div>
        </div>
        {Object.keys(mappedQueriesToHeadings).map(heading => {
          return (
            <div key={heading}>
              <div className={styles.heading}>
                {heading} <span className={styles.queries}>{mappedQueriesToHeadings[heading].length} queries</span>
              </div>
              {mappedQueriesToHeadings[heading].map((q: RichHistoryQuery) => {
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
            </div>
          );
        })}
        <div className={styles.footer}>The history is local to your browser and is not shared with others.</div>
      </div>
    </div>
  );
}

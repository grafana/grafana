import React, { useState } from 'react';
import { css } from 'emotion';
import { uniqBy } from 'lodash';

// Types
import { RichHistoryQuery, ExploreId } from 'app/types/explore';

// Utils
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { getExploreDatasources } from '../state/selectors';

import { SortOrder } from 'app/core/utils/explore';
import {
  sortQueries,
  mapNumbertoTimeInSlider,
  createRetentionPeriodBoundary,
  mapQueriesToHeadings,
} from 'app/core/utils/richHistory';

// Components
import RichHistoryCard from './RichHistoryCard';
import { sortOrderOptions } from './RichHistory';
import { Select, Slider } from '@grafana/ui';

interface Props {
  queries: RichHistoryQuery[];
  sortOrder: SortOrder;
  activeDatasourceOnly: boolean;
  datasourceFilters: SelectableValue[] | null;
  retentionPeriod: number;
  exploreId: ExploreId;
  onChangeSortOrder: (sortOrder: SortOrder) => void;
  onSelectDatasourceFilters: (value: SelectableValue[] | null) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;

  /* 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab */
  const cardWidth = '100% - 134px';
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
      width: 127px;
      margin-right: ${theme.spacing.sm};
      .slider {
        bottom: 10px;
        height: 200px;
        width: 127px;
        padding: ${theme.spacing.xs} 0;
      }
    `,
    slider: css`
      position: fixed;
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
    feedback: css`
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
  } = props;

  const [sliderRetentionFilter, setSliderRetentionFilter] = useState<[number, number]>([0, retentionPeriod]);

  const theme = useTheme();
  const styles = getStyles(theme);
  const listOfDsNamesWithQueries = uniqBy(queries, 'datasourceName').map(d => d.datasourceName);

  /* Display only explore datasoources, that have saved queries */
  const datasources = getExploreDatasources()
    ?.filter(ds => listOfDsNamesWithQueries.includes(ds.name))
    .map(d => {
      return { value: d.value!, label: d.value!, imgUrl: d.meta.info.logos.small };
    });

  const listOfDatasourceFilters = datasourceFilters?.map(d => d.value);
  const filteredQueriesByDatasource = datasourceFilters
    ? queries?.filter(q => listOfDatasourceFilters?.includes(q.datasourceName))
    : queries;

  const sortedQueries = sortQueries(filteredQueriesByDatasource, sortOrder);
  const queriesWithinSelectedTimeline = sortedQueries?.filter(
    q =>
      q.ts < createRetentionPeriodBoundary(sliderRetentionFilter[0], true) &&
      q.ts > createRetentionPeriodBoundary(sliderRetentionFilter[1], false)
  );

  /* mappedQueriesToHeadings is an object where query headings (stringified dates/data sources)
   * are keys and arrays with queries that belong to that headings are values.
   */
  let mappedQueriesToHeadings = mapQueriesToHeadings(queriesWithinSelectedTimeline, sortOrder);

  return (
    <div className={styles.container}>
      <div className={styles.containerSlider}>
        <div className={styles.slider}>
          <div className="label-slider">
            Filter history <br />
            between
          </div>
          <div className="label-slider">{mapNumbertoTimeInSlider(sliderRetentionFilter[0])}</div>
          <div className="slider">
            <Slider
              tooltipAlwaysVisible={false}
              min={0}
              max={retentionPeriod}
              value={sliderRetentionFilter}
              orientation="vertical"
              formatTooltipResult={mapNumbertoTimeInSlider}
              reverse={true}
              onAfterChange={setSliderRetentionFilter as () => number[]}
            />
          </div>
          <div className="label-slider">{mapNumbertoTimeInSlider(sliderRetentionFilter[1])}</div>
        </div>
      </div>

      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!activeDatasourceOnly && (
            <div className={styles.multiselect}>
              <Select
                isMulti={true}
                options={datasources}
                value={datasourceFilters}
                placeholder="Filter queries for specific datasources(s)"
                onChange={onSelectDatasourceFilters}
              />
            </div>
          )}
          <div className={styles.sort}>
            <Select
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
              {mappedQueriesToHeadings[heading].map((q: RichHistoryQuery) => (
                <RichHistoryCard query={q} key={q.ts} exploreId={exploreId} />
              ))}
            </div>
          );
        })}
        <div className={styles.feedback}>
          Query history is a beta feature. The history is local to your browser and is not shared with others.
          <a href="https://github.com/grafana/grafana/issues/new/choose">Feedback?</a>
        </div>
      </div>
    </div>
  );
}

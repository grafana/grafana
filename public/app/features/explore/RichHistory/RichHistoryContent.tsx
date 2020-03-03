import React, { useEffect, useState } from 'react';
import { css } from 'emotion';

// Types
import { RichHistoryQuery } from 'app/types/explore';

// Utils
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { getExploreDatasources } from '../state/selectors';

import {
  sortQueries,
  SortOrder,
  mapNumbertoTimeInSlider,
  createRetentionPeriodBoundary,
} from '../../../core/utils/explore';

// Components
import { RichHistoryCard } from './RichHistoryCard';
import { Select, Slider } from '@grafana/ui';

const sortOrderOptions = [
  { label: 'Time ascending', value: SortOrder.Ascending },
  { label: 'Time descending', value: SortOrder.Descending },
  { label: 'Datasource A-Z', value: SortOrder.DatasourceAZ },
  { label: 'Datasource Z-A', value: SortOrder.DatasourceZA },
];

export type DataSourceOption = {
  value: string;
  label: string;
  imgUrl?: string;
};

interface RichHistoryContentProps {
  queries: RichHistoryQuery[];
  sortOrder: SortOrder;
  activeDatasourceOnly: boolean;
  activeDatasourceInstance: string;
  datasourceFilters: DataSourceOption[] | null;
  onChangeSortOrder: (sortOrder: SortOrder) => void;
  onChangeRichHistoryProperty: (ts: number, property: string, updatedProperty?: string) => void;
  onSelectDatasourceFilters: (datasources: DataSourceOption[] | null) => void;
  onlyStarred?: boolean;
  retentionPeriod?: number;
}

const getStyles = stylesFactory((theme: GrafanaTheme, onlyStarred: boolean) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;

  /* 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab */
  const cardWidth = onlyStarred ? '100%' : '100% - 134px';
  return {
    container: css`
      display: flex;
      .label-slider {
        font-size: ${theme.typography.size.sm};
        &:last-of-type {
          margin-top: ${theme.spacing.lg};
        }
        &:first-of-type {
          margin-top: ${theme.spacing.sm};
          font-weight: ${theme.typography.weight.semibold};
          margin-bottom: ${theme.spacing.xs};
        }
      }
    `,
    containerContent: css`
      width: calc(${cardWidth});
    `,
    containerSlider: css`
      width: 125px;
      margin-right: ${theme.spacing.sm};
      .slider {
        bottom: 10px;
        height: 200px;
        width: 125px;
        padding: ${theme.spacing.xs} 0;
      }
    `,
    slider: css`
      height: 300px;
      position: absolute;
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
      margin: ${theme.spacing.sm} ${theme.spacing.xxs};
    `,
  };
});

export function RichHistoryContent(props: RichHistoryContentProps) {
  const {
    datasourceFilters,
    onSelectDatasourceFilters,
    queries,
    onlyStarred,
    onChangeSortOrder,
    sortOrder,
    onChangeRichHistoryProperty,
    activeDatasourceOnly,
    activeDatasourceInstance,
    retentionPeriod,
  } = props;

  const [sliderRetentionFilter, setSliderRetentionFilter] = useState([0, retentionPeriod]);

  /* If user selects activeDatasourceOnly === true, set datasource filter to currently active datasource.
   *  Filtering based on datasource won't be available. Otherwise set to null, as filtering will be
   * available for user.
   */
  useEffect(() => {
    activeDatasourceOnly && activeDatasourceInstance
      ? onSelectDatasourceFilters([{ label: activeDatasourceInstance, value: activeDatasourceInstance }])
      : onSelectDatasourceFilters(null);
  }, [activeDatasourceInstance, activeDatasourceOnly]);

  const theme = useTheme();
  const styles = getStyles(theme, onlyStarred);
  const exploreDatasources = getExploreDatasources().map(d => {
    return { value: d.value, label: d.value, imgUrl: d.meta.info.logos.small };
  });

  const filteredQueries: RichHistoryQuery[] = onlyStarred ? queries.filter(q => q.starred === true) : queries;
  const sortedQueries = sortQueries(filteredQueries, sortOrder);
  const listOfDatasourceFilters = datasourceFilters && datasourceFilters.map(d => d.value);
  const filteredQueriesByDatasource = datasourceFilters
    ? sortedQueries.filter(q => listOfDatasourceFilters.includes(q.datasourceName))
    : sortedQueries;

  const queriesToDisplay = filteredQueriesByDatasource.filter(
    q =>
      q.ts < createRetentionPeriodBoundary(sliderRetentionFilter[0], true) &&
      q.ts > createRetentionPeriodBoundary(sliderRetentionFilter[1], false)
  );

  // const starredQueries = onlyStarred && queries.filter(q => q.starred === true);
  // const starredQueriesFilteredByDatasource = datasourceFilters
  // ? starredQueries.filter(q => listOfDatasourceFilters.includes(q.datasourceName))
  // : starredQueries;
  // const sortedStarredQueries = sortQueries(starredQueriesFilteredByDatasource, sortOrder);

  return (
    <div className={styles.container}>
      {!onlyStarred && (
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
                onAfterChange={setSliderRetentionFilter}
              />
            </div>
            <div className="label-slider">{mapNumbertoTimeInSlider(sliderRetentionFilter[1])}</div>
          </div>
        </div>
      )}

      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!activeDatasourceOnly && (
            <div className={styles.multiselect}>
              <Select
                isMulti={true}
                options={exploreDatasources}
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

        {onlyStarred &&
          filteredQueries.map(q => {
            return <RichHistoryCard query={q} key={q.ts} onChangeRichHistoryProperty={onChangeRichHistoryProperty} />;
          })}

        {!onlyStarred &&
          queriesToDisplay.map((q, index) => {
            const previousDateString = index > 0 ? new Date(queriesToDisplay[index - 1].ts).toDateString() : '';
            if (new Date(q.ts).toDateString() !== previousDateString) {
              return (
                <div key={q.ts}>
                  <div className={styles.heading}>{new Date(q.ts).toDateString().substring(4)}</div>
                  <RichHistoryCard query={q} key={q.ts} onChangeRichHistoryProperty={onChangeRichHistoryProperty} />
                </div>
              );
            } else {
              return <RichHistoryCard query={q} key={q.ts} onChangeRichHistoryProperty={onChangeRichHistoryProperty} />;
            }
          })}
      </div>
    </div>
  );
}

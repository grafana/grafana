import React, { useEffect } from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme, Select, Slider } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { getExploreDatasources } from '../state/selectors';
import { QueryHistoryCard } from './QueryHistoryCard';
import { sortQueries, SortOrder, mapNumbertoTimeInSlider } from '../../../core/utils/explore';

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

export type QueryHistoryQuery = {
  ts: number;
  datasourceName: string;
  datasourceId: string;
  starred: boolean;
  comment: string;
  queries: string[];
  sessionName: string;
  timeRange?: string;
};

interface QueryHistoryContentProps {
  queries: QueryHistoryQuery[];
  sortOrder: SortOrder;
  onlyStarred: boolean;
  onlyActiveDatasourceHistory: boolean;
  activeDatasourceInstance: string;
  onChangeSortOrder: (sortOrder: SortOrder) => void;
  onChangeQueryHistoryProperty: (ts: number, property: string) => void;
  datasourceFilters?: DataSourceOption[] | null;
  onSelectDatasourceFilters?: (datasources: DataSourceOption[] | null) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme, onlyStarred: boolean) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  // 134px is based on the width of the Query history tabs bar, so the content is aligned to right side of the tab
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
  };
});

export function QueryHistoryContent(props: QueryHistoryContentProps) {
  const {
    datasourceFilters,
    onSelectDatasourceFilters,
    queries,
    onlyStarred,
    onChangeSortOrder,
    sortOrder,
    onChangeQueryHistoryProperty,
    onlyActiveDatasourceHistory,
    activeDatasourceInstance,
  } = props;

  useEffect(() => {
    onlyActiveDatasourceHistory && activeDatasourceInstance
      ? onSelectDatasourceFilters([{ label: activeDatasourceInstance, value: activeDatasourceInstance }])
      : onSelectDatasourceFilters(null);
  }, [activeDatasourceInstance, onlyActiveDatasourceHistory]);

  const theme = useTheme();
  const styles = getStyles(theme, onlyStarred);
  const exploreDatasources = getExploreDatasources().map(d => {
    return { value: d.value, label: d.value, imgUrl: d.meta.info.logos.small };
  });

  const listOfDatasourceFilters = datasourceFilters && datasourceFilters.map(d => d.value);

  const filteredQueries: QueryHistoryQuery[] = onlyStarred ? queries.filter(q => q.starred === true) : queries;
  const sortedQueries = sortQueries(filteredQueries, sortOrder);
  const queriesToDisplay = datasourceFilters
    ? sortedQueries.filter(q => listOfDatasourceFilters.includes(q.datasourceName))
    : sortedQueries;

  return (
    <div className={styles.container}>
      {!onlyStarred && (
        <div className={styles.containerSlider}>
          <div className={styles.slider}>
            <div className="label-slider">
              Filter history <br />
              between
            </div>
            <div className="label-slider">today</div>
            <div className="slider">
              <Slider
                tooltipAlwaysVisible={false}
                min={0}
                max={7}
                orientation="vertical"
                formatTooltipResult={mapNumbertoTimeInSlider}
                reverse={true}
              />
            </div>
            <div className="label-slider">5 days ago</div>
          </div>
        </div>
      )}
      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!onlyActiveDatasourceHistory && (
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
        {queriesToDisplay.map(q => (
          <QueryHistoryCard query={q} key={q.ts} onChangeQueryHistoryProperty={onChangeQueryHistoryProperty} />
        ))}
      </div>
    </div>
  );
}

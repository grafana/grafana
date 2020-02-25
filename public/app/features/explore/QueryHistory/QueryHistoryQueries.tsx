import React from 'react';
import { css } from 'emotion';
import { stylesFactory, withTheme, Themeable, Select } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { getExploreDatasources } from '../state/selectors';
import { DataSourceOption, SortingValue } from './QueryHistory';
import { QueryHistoryCard } from './QueryHistoryCard';

interface QueryHistoryQueriesProps extends Themeable {
  queries: Query[];
  sortingValue: SortingValue;
  onlyStarred: boolean;
  onChangeSortingValue: (sortingValue: SortingValue) => void;
  updateStarredQuery: (ts: number) => void;
  datasourceFilters?: DataSourceOption[] | null;
  onSelectDatasourceFilters?: (datasources: DataSourceOption[] | null) => void;
}

export type Query = {
  ts: number;
  datasourceName: string;
  datasourceType: string;
  starred: boolean;
  comment: string;
  queries: string[];
  sessionName: string;
  timeRange?: string;
};

const getStyles = stylesFactory((theme: GrafanaTheme, onlyStarred: boolean) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  const cardWidth = onlyStarred ? '100%' : '100% - 134px';
  return {
    container: css`
      display: flex;
    `,
    containerContent: css`
      width: calc(${cardWidth});
    `,
    containerSlider: css`
      width: 125px;
      margin-right: ${theme.spacing.sm};
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

const sortingOptions = [
  { label: 'Time ascending', value: 'Time ascending' },
  { label: 'Time descending', value: 'Time descending' },
  { label: 'Datasource A-Z', value: 'Datasource A-Z' },
  { label: 'Datasource Z-A', value: 'Datasource Z-A' },
];

function UnThemedQueryHistoryQueries(props: QueryHistoryQueriesProps) {
  const {
    theme,
    datasourceFilters,
    onSelectDatasourceFilters,
    queries,
    onlyStarred,
    onChangeSortingValue,
    sortingValue,
    updateStarredQuery,
  } = props;
  const styles = getStyles(theme, onlyStarred);
  const exploreDatasources = getExploreDatasources().map(d => {
    return { value: d.value, label: d.value, imgUrl: d.meta.info.logos.small };
  });

  const sessionName = (date: string, name?: string) => {
    const dateReadable = date;
    return (
      <div className={styles.sessionName}>
        <h4>{name || dateReadable}</h4>
        {name && <div>{dateReadable}</div>}
      </div>
    );
  };

  const sortQueries = (array: Query[], sortingValue: SortingValue) => {
    let sortFunc;

    if (sortingValue === 'Time ascending') {
      sortFunc = (a: Query, b: Query) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
    }
    if (sortingValue === 'Time descending') {
      sortFunc = (a: Query, b: Query) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0);
    }

    if (sortingValue === 'Datasource A-Z') {
      sortFunc = (a: Query, b: Query) =>
        a.datasourceName < b.datasourceName ? -1 : a.datasourceName > b.datasourceName ? 1 : 0;
    }

    if (sortingValue === 'Datasource Z-A') {
      sortFunc = (a: Query, b: Query) =>
        a.datasourceName < b.datasourceName ? 1 : a.datasourceName > b.datasourceName ? -1 : 0;
    }

    return array.sort(sortFunc);
  };

  const listOfFilteredDatasources = datasourceFilters && datasourceFilters.map(d => d.value);

  const displayedQueries: Query[] = onlyStarred ? queries.filter(q => q.starred === true) : queries;
  const sortedQueries = sortQueries(displayedQueries, sortingValue);
  const queriesToDisplay = datasourceFilters
    ? sortedQueries.filter(q => listOfFilteredDatasources.includes(q.datasourceName))
    : sortedQueries;

  return (
    <div className={styles.container}>
      {!onlyStarred && <div className={styles.containerSlider}></div>}
      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          {!onlyStarred && (
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
              options={sortingOptions}
              placeholder="Sort queries by"
              onChange={e => onChangeSortingValue(e.value as SortingValue)}
            />
          </div>
        </div>
        {sessionName('January 3rd, 29 queries', 'Custom title')}
        {queriesToDisplay.map(q => (
          <QueryHistoryCard query={q} key={q.ts} updateStarredQuery={updateStarredQuery} />
        ))}
      </div>
    </div>
  );
}

export const QueryHistoryQueries = withTheme(UnThemedQueryHistoryQueries);
QueryHistoryQueries.displayName = 'QueryHistoryQueries';

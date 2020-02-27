import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { stylesFactory, withTheme, Themeable, Select } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { getExploreDatasources } from '../state/selectors';
import { QueryHistoryCard } from './QueryHistoryCard';
import { sortQueries } from '../../../core/utils/explore';

export type SortingValue = 'Time ascending' | 'Time descending' | 'Datasource A-Z' | 'Datasource Z-A';

const sortingOptions = [
  { label: 'Time ascending', value: 'Time ascending' },
  { label: 'Time descending', value: 'Time descending' },
  { label: 'Datasource A-Z', value: 'Datasource A-Z' },
  { label: 'Datasource Z-A', value: 'Datasource Z-A' },
];

export type DataSourceOption = {
  value: string;
  label: string;
  imgUrl?: string;
};

export type QueryHistoryQuery = {
  ts: number;
  datasourceName: string;
  datasourceType: string;
  starred: boolean;
  comment: string;
  queries: string[];
  sessionName: string;
  timeRange?: string;
};

interface QueryHistoryQueriesProps extends Themeable {
  queries: QueryHistoryQuery[];
  sortingValue: SortingValue;
  onlyStarred: boolean;
  onChangeSortingValue: (sortingValue: SortingValue) => void;
  onChangeQueryHistoryProperty: (ts: number, property: string) => void;
  datasourceFilters?: DataSourceOption[] | null;
  onSelectDatasourceFilters?: (datasources: DataSourceOption[] | null) => void;
}

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

class UnThemedQueryHistoryQueries extends PureComponent<QueryHistoryQueriesProps> {
  render() {
    const {
      theme,
      datasourceFilters,
      onSelectDatasourceFilters,
      queries,
      onlyStarred,
      onChangeSortingValue,
      sortingValue,
      onChangeQueryHistoryProperty,
    } = this.props;
    const styles = getStyles(theme, onlyStarred);
    const exploreDatasources = getExploreDatasources().map(d => {
      return { value: d.value, label: d.value, imgUrl: d.meta.info.logos.small };
    });

    const listOfFilteredDatasources = datasourceFilters && datasourceFilters.map(d => d.value);

    const filteredQueries: QueryHistoryQuery[] = onlyStarred ? queries.filter(q => q.starred === true) : queries;
    const sortedQueries = sortQueries(filteredQueries, sortingValue);
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
          {queriesToDisplay.map(q => (
            <QueryHistoryCard query={q} key={q.ts} onChangeQueryHistoryProperty={onChangeQueryHistoryProperty} />
          ))}
        </div>
      </div>
    );
  }
}

export const QueryHistoryQueries = withTheme(UnThemedQueryHistoryQueries);
QueryHistoryQueries.displayName = 'QueryHistoryQueries';

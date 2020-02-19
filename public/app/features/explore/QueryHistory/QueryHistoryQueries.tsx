import React from 'react';
import { css } from 'emotion';
import { stylesFactory, withTheme, Themeable, Select } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { getExploreDatasources } from '../state/selectors';
import { DataSourceOption } from './QueryHistory';
import { QueryHistoryCard } from './QueryHistoryCard';

interface QueryHistoryQueriesProps extends Themeable {
  onSelectDatasources: (datasources: DataSourceOption[] | null) => void;
  datasources: DataSourceOption[] | null;
  queries: Query[];
}

export type Query = {
  timestamp: number;
  datasourceName: string;
  datasourceType: string;
  starred: boolean;
  comment: string;
  queries: string[];
  sessionName: string;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark4;
  return {
    container: css`
      display: flex;
    `,
    containerContent: css`
      width: calc(100% - 134px);
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

const sortingValues = [
  { label: 'Time ascending', value: 'Time ascending' },
  { label: 'Time descending', value: 'Time descending' },
  { label: 'Datasource A-Z', value: 'Datasource A-Z' },
  { label: 'Datasource Z-A', value: 'Datasource Z-A' },
];

function UnThemedQueryHistoryQueries(props: QueryHistoryQueriesProps) {
  const { theme, datasources, onSelectDatasources, queries } = props;
  const styles = getStyles(theme);
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

  return (
    <div className={styles.container}>
      <div className={styles.containerSlider}></div>
      <div className={styles.containerContent}>
        <div className={styles.selectors}>
          <div className={styles.multiselect}>
            <Select
              isMulti={true}
              options={exploreDatasources}
              value={datasources}
              placeholder="Filter queries for specific datasources(s)"
              onChange={onSelectDatasources}
            />
          </div>
          <div className={styles.sort}>
            <Select options={sortingValues} placeholder="Sort queries by" />
          </div>
        </div>
        {sessionName('January 3rd, 29 queries', 'Custom title')}
        {queries.map(q => (
          <QueryHistoryCard query={q} />
        ))}
      </div>
    </div>
  );
}

export const QueryHistoryQueries = withTheme(UnThemedQueryHistoryQueries);
QueryHistoryQueries.displayName = 'QueryHistoryQueries';

import React from 'react';
import { css } from 'emotion';
import { stylesFactory, withTheme, Themeable, Select, selectThemeVariant } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { getExploreDatasources } from './state/selectors';
import { Option } from './QueryHistory';

interface QueryHistoryQueriesProps extends Themeable {
  onSelectDatasources: (datasources: Option[] | null) => void;
  datasources: Option[] | null;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark4 }, theme.type);
  const cardColor = selectThemeVariant({ light: theme.colors.white, dark: theme.colors.black }, theme.type);
  return {
    container: css`
      display: flex;
      margin-top: 10px;
    `,
    containerRight: css`
      width: calc(100% - 134px);
    `,
    containerLeft: css`
      width: 124px;
      margin-right: 10px;
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
    select: css`
      width: 200px;
    `,
    flex: css`
      display: flex;
    `,
    title: css`
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin-top: ${theme.spacing.lg};
      h4 {
        margin: 0 10px 0 0;
      }
    `,
    queryCard: css`
      border: 1px solid ${bgColor};
      padding: 10px;
      margin: 10px 0;
      box-shadow: 0px 2px 2px ${bgColor};
      background-color: ${cardColor};
      border-radius: ${theme.border.radius};
      display: flex;
    `,
    queryCardLeft: css``,
    queryCardRight: css`
      flex: 100px;
      display: flex;
      justify-content: flex-end;
      i {
        font-size: ${theme.typography.size.lg};
        font-weight: ${theme.typography.weight.bold};
        margin: 3px;
        cursor: pointer;
      }
    `,
    queryRow: css`
      border-top: 2px solid ${bgColor};
      font-weight: ${theme.typography.weight.bold};
      padding: 4px 2px;
      :first-child {
        border-top: none;
        padding: 0 0 4px 0;
      }
      :last-child {
        border-top: none;
      }
    `,
  };
});

const values = [
  { label: 'Time ascending', value: 'Time ascending' },
  { label: 'Time descending', value: 'Time descending' },
  { label: 'Datasource A-Z', value: 'Datasource A-Z' },
  { label: 'Datasource Z-A', value: 'Datasource Z-A' },
];

function UnThemedQueryHistoryQueries(props: QueryHistoryQueriesProps) {
  const { theme, datasources, onSelectDatasources } = props;
  const styles = getStyles(theme);
  const exploreDatasources = getExploreDatasources().map(d => {
    return { value: d.value, label: d.value, imgUrl: d.meta.info.logos.small };
  });

  const query1 =
    "rate( prometheus_remote_storage_samples_in_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – ignoring(queue) group_right(instance) rate(prometheus_remote_ storage_succeeded_samples_total {((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m]) – rate(prometheus_remote_storage_ dropped_samples_total{((cluster = ~'$cluster'), (instance = ~'$instance'))}[5m])}";

  const query2 = 'prometheus_remote_storage_shards_max{cluster=~"$cluster", instance=~"$instance"}';

  return (
    <div className={styles.container}>
      <div className={styles.containerLeft}></div>
      <div className={styles.containerRight}>
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
          <div className={styles.select}>
            <Select options={values} placeholder="Sort queries by" />
          </div>
        </div>
        <div className={styles.title}>
          <h4>A longer custom title for this session</h4>
          <div>January 3rd, 29 queries</div>
        </div>
        <div className={styles.queryCard}>
          <div className={styles.queryCardLeft}>
            <div className={styles.queryRow}>{query1}</div>
            <div className={styles.queryRow}>{query2}</div>
            <div className={styles.queryRow}>{query2}</div>
            <div className={styles.queryRow}>{query2}</div>
            <div>An optional description of what the query does, the user has added this information.</div>
          </div>
          <div className={styles.queryCardRight}>
            <i className="fa fa-fw fa-copy"></i>
            <i className="fa fa-fw fa-link" style={{ fontWeight: 'normal' }}></i>
            <i className="fa fa-fw fa-star-o"></i>
          </div>
        </div>
        <div className={styles.queryCard}>
          <div className={styles.queryCardLeft}>
            <div className={styles.queryRow}>{query2}</div>
          </div>
          <div className={styles.queryCardRight}>
            <i className="fa fa-fw fa-copy"></i>
            <i className="fa fa-fw fa-link" style={{ fontWeight: 'normal' }}></i>
            <i className="fa fa-fw fa-star-o"></i>
          </div>
        </div>
        <div className={styles.queryCard}>
          <div className={styles.queryCardLeft}>
            <div className={styles.queryRow}>{query1}</div>
            <div>An optional description of what the query does, the user has added this information.</div>
          </div>
          <div className={styles.queryCardRight}>
            <i className="fa fa-fw fa-copy"></i>
            <i className="fa fa-fw fa-link" style={{ fontWeight: 'normal' }}></i>
            <i className="fa fa-fw fa-star-o"></i>
          </div>
        </div>
      </div>
    </div>
  );
}

export const QueryHistoryQueries = withTheme(UnThemedQueryHistoryQueries);
QueryHistoryQueries.displayName = 'QueryHistoryQueries';

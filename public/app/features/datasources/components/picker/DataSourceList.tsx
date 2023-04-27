import { css, cx } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { useDatasources, useRecentlyUsedDataSources } from '../../hooks';

import { DataSourceCard } from './DataSourceCard';
import { getDataSourceCompareFn, isDataSourceMatch } from './utils';

/**
 * Component props description for the {@link DataSourceList}
 *
 * @internal
 */
export interface DataSourceListProps {
  className?: string;
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
  /** Would be nicer if these parameters were part of a filtering object */
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
}

export function DataSourceList(props: DataSourceListProps) {
  const { className, current, onChange } = props;
  const styles = useStyles2(getStyles);
  // QUESTION: Should we use data from the Redux store as admin DS view does?
  const dataSources = useDatasources({
    alerting: props.alerting,
    annotations: props.annotations,
    dashboard: props.dashboard,
    logs: props.logs,
    metrics: props.metrics,
    mixed: props.mixed,
    pluginId: props.pluginId,
    tracing: props.tracing,
    type: props.type,
    variables: props.variables,
  });

  const [recentlyUsedDataSources, pushRecentlyUsedDataSource] = useRecentlyUsedDataSources();
  const filteredDataSources = props.filter ? dataSources.filter(props.filter) : dataSources;

  return (
    <div className={className}>
      {filteredDataSources.length === 0 && <div className={styles.noDataSourcesFound}>No data sources found</div>}
      {filteredDataSources
        .sort(getDataSourceCompareFn(current, recentlyUsedDataSources, getDataSourceVariableIDs()))
        .map((ds) => (
          <DataSourceCard
            key={ds.uid}
            ds={ds}
            onClick={() => {
              pushRecentlyUsedDataSource(ds);
              onChange(ds);
            }}
            selected={!!isDataSourceMatch(ds, current)}
          />
        ))}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noDataSourcesFound: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: ${theme.spacing(2)};
    `,
  };
}

function getDataSourceVariableIDs() {
  const templateSrv = getTemplateSrv();
  /** Unforunately there is no easy way to identify data sources that are variables. The uid of the data source will be the name of the variable in a templating syntax $([name]) **/
  return templateSrv
    .getVariables()
    .filter((v) => v.type === 'datasource')
    .map((v) => `\${${v.id}}`);
}

import { css, cx } from '@emotion/css';
import React from 'react';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2, LinkButton } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { AccessControlAction } from 'app/types';

import { useDatasources, useRecentlyUsedDataSources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
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
  onClickEmptyStateCTA?: () => void;
}

export function DataSourceList(props: DataSourceListProps) {
  const { className, current, onChange, onClickEmptyStateCTA } = props;
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
  const styles = useStyles2(getListStyles);

  return (
    <div className={cx(className, styles.container)}>
      {filteredDataSources.length === 0 && (
        <EmptyState className={styles.emptyState} onClickCTA={onClickEmptyStateCTA} />
      )}
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

function getListStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
    `,
    emptyState: css`
      height: 100%;
      flex: 1;
    `,
  };
}

function EmptyState({ className, onClickCTA }: { className?: string; onClickCTA?: () => void }) {
  const styles = useStyles2(getEmptyStateStyles);
  return (
    <div className={cx(className, styles.container)}>
      <p className={styles.message}>No data sources found</p>
      <AddNewDataSourceButton onClick={onClickCTA} />
    </div>
  );
}

function getEmptyStateStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `,
    message: css`
      margin-bottom: ${theme.spacing(3)};
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

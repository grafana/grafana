import React from 'react';

import { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { DataSourceCard } from './DataSourceCard';
import { isDataSourceMatch, useDatasources, useRecentlyUsedDataSources } from './utils';

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

  const orderedDataSources = orderDataSourcesByRecentlyUsed(recentlyUsedDataSources, dataSources);

  return (
    <div className={className}>
      {orderedDataSources
        .filter((ds) => (props.filter ? props.filter(ds) : true))
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

function orderDataSourcesByRecentlyUsed(recentlyUsedDataSources: string[], dataSources: DataSourceInstanceSettings[]) {
  const recentlyUsed = recentlyUsedDataSources
    .map((dsUID) => dataSources.find((ds) => ds.uid === dsUID))
    .filter((ds): ds is DataSourceInstanceSettings => !!ds); //Custom typeguard to make sure ds is not undefined

  const templateSrv = getTemplateSrv();
  /** Unforunately there is no easy way to identify data sources that are variables. The uid of the data source will be the name of the variable in a templating syntax $([name]) **/
  const dataSourceVariablesIDs = templateSrv.getVariables().map((v) => `\${${v.id}}`);
  const dataSourceVariables = dataSourceVariablesIDs
    .map((dsUID) => dataSources.find((ds) => ds.uid === dsUID))
    .filter((ds): ds is DataSourceInstanceSettings => !!ds);

  const otherDataSources = dataSources.filter(
    (ds) => !recentlyUsedDataSources.includes(ds.uid) && !dataSourceVariablesIDs.includes(ds.uid)
  );
  return [...recentlyUsed, ...dataSourceVariables, ...otherDataSources];
}

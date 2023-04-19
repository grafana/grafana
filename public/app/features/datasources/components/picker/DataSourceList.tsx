import React from 'react';

import { DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';

import { DataSourceCard } from './DataSourceCard';
import { isDataSourceMatch, useGetDatasources } from './utils';

/**
 * Component props description for the {@link DataSourceList}
 *
 * @internal
 */
export interface DataSourceListProps {
  className?: string;
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | DataSourceInstanceSettings | string | null | undefined;
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
  const getDataSources = useGetDatasources({ ...props });

  return (
    <div className={className}>
      {getDataSources({ ...props }).map((ds) => (
        <DataSourceCard key={ds.uid} ds={ds} onClick={() => onChange(ds)} selected={!!isDataSourceMatch(ds, current)} />
      ))}
    </div>
  );
}

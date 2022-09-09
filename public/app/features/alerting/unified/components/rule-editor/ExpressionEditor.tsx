import { noop } from 'lodash';
import React, { FC, useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, DataQuery } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

export interface ExpressionEditorProps {
  value?: string;
  onChange: (value: string) => void;
  dataSourceName: string; // will be a prometheus or loki datasource
}

export const ExpressionEditor: FC<ExpressionEditorProps> = ({ value, onChange, dataSourceName }) => {
  const { mapToValue, mapToQuery } = useQueryMappers(dataSourceName);
  const query = mapToQuery({ refId: 'A', hide: false }, value);

  const {
    error,
    loading,
    value: dataSource,
  } = useAsync(() => {
    return getDataSourceSrv().get(dataSourceName);
  }, [dataSourceName]);

  const onChangeQuery = useCallback(
    (query: DataQuery) => {
      onChange(mapToValue(query));
    },
    [onChange, mapToValue]
  );

  if (loading || dataSource?.name !== dataSourceName) {
    return null;
  }

  if (error || !dataSource || !dataSource?.components?.QueryEditor) {
    const errorMessage = error?.message || 'Data source plugin does not export any Query Editor component';
    return <div>Could not load query editor due to: {errorMessage}</div>;
  }

  const QueryEditor = dataSource?.components?.QueryEditor;

  return (
    <QueryEditor
      query={query}
      queries={[query]}
      app={CoreApp.CloudAlerting}
      onChange={onChangeQuery}
      onRunQuery={noop}
      datasource={dataSource}
    />
  );
};

type QueryMappers<T extends DataQuery = DataQuery> = {
  mapToValue: (query: T) => string;
  mapToQuery: (existing: T, value: string | undefined) => T;
};

function useQueryMappers(dataSourceName: string): QueryMappers {
  return useMemo(() => {
    const settings = getDataSourceSrv().getInstanceSettings(dataSourceName);

    switch (settings?.type) {
      case 'loki':
      case 'prometheus':
        return {
          mapToValue: (query: DataQuery) => (query as PromQuery | LokiQuery).expr,
          mapToQuery: (existing: DataQuery, value: string | undefined) => ({ ...existing, expr: value }),
        };
      default:
        throw new Error(`${dataSourceName} is not supported as an expression editor`);
    }
  }, [dataSourceName]);
}

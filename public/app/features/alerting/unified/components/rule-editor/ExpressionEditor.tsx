import React, { FC, useCallback, useMemo, useState } from 'react';
import { noop } from 'lodash';
import { CoreApp, DataQuery } from '@grafana/data';
import { QueryEditorRenderer } from 'app/features/query/components/QueryEditorRenderer/QueryEditorRenderer';
import { getDataSourceSrv } from '@grafana/runtime';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { LokiQuery } from 'app/plugins/datasource/loki/types';

interface Props {
  value?: string;
  onChange: (value: string) => void;
  dataSourceName: string; // will be a prometheus or loki datasource
}

export const ExpressionEditor: FC<Props> = ({ value, onChange, dataSourceName }) => {
  const { mapToValue, mapToQuery } = useQueryMappers(dataSourceName);
  const [query, setQuery] = useState(mapToQuery({ refId: 'A', hide: false }, value));

  const onChangeQuery = useCallback(
    (query: DataQuery) => {
      setQuery(query);
      onChange(mapToValue(query));
    },
    [onChange, mapToValue]
  );

  return (
    <QueryEditorRenderer
      query={query}
      queries={[query]}
      app={CoreApp.CloudAlerting}
      nameOrUid={dataSourceName}
      onChange={onChangeQuery}
      onRunQuery={noop}
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
          mapToValue: (query: PromQuery | LokiQuery) => query.expr,
          mapToQuery: (existing: DataQuery, value: string | undefined) => ({ ...existing, expr: value }),
        };
      default:
        throw new Error(`${dataSourceName} is not supported as an expression editor`);
    }
  }, [dataSourceName]);
}

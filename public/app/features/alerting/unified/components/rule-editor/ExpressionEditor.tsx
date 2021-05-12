import React, { FC, useCallback, useMemo, useState } from 'react';
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

const noop = () => {};

// @TODO implement proper prom/loki query editor here
export const ExpressionEditor: FC<Props> = ({ value, onChange, dataSourceName }) => {
  const [query, setQuery] = useState<DataQuery>({ refId: 'A', hide: false });
  const mapper = useExpressionMapper(dataSourceName);

  const onChangeQuery = useCallback(
    (query: DataQuery) => {
      setQuery(query);
      onChange(mapper(query));
    },
    [onChange, mapper]
  );

  return (
    <QueryEditorRenderer
      query={query}
      queries={[query]}
      app={CoreApp.CloudAlerting}
      name={dataSourceName}
      onChange={onChangeQuery}
      onRunQuery={noop}
    />
  );
};

type ExpressionMapper<T extends DataQuery = DataQuery> = (query: T) => string;

function useExpressionMapper(dataSourceName: string): ExpressionMapper {
  return useMemo(() => {
    const settings = getDataSourceSrv().getInstanceSettings(dataSourceName);

    switch (settings?.type) {
      case 'loki':
      case 'prometheus':
        return (query: PromQuery | LokiQuery) => query.expr;
      default:
        return () => {
          throw new Error(`${dataSourceName} is not supported as an expression editor`);
        };
    }
  }, [dataSourceName]);
}

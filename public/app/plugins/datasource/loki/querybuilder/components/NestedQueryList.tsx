import React from 'react';

import { Stack } from '@grafana/experimental';

import { LokiDatasource } from '../../datasource';
import { LokiVisualQuery, LokiVisualQueryBinary } from '../types';

import { NestedQuery } from './NestedQuery';

export interface Props {
  query: LokiVisualQuery;
  datasource: LokiDatasource;
  showExplain: boolean;
  onChange: (query: LokiVisualQuery) => void;
  onRunQuery: () => void;
}

export function NestedQueryList({ query, datasource, onChange, onRunQuery, showExplain }: Props) {
  const nestedQueries = query.binaryQueries ?? [];

  const onNestedQueryUpdate = (index: number, update: LokiVisualQueryBinary) => {
    const updatedList = [...nestedQueries];
    updatedList.splice(index, 1, update);
    onChange({ ...query, binaryQueries: updatedList });
  };

  const onRemove = (index: number) => {
    const updatedList = [...nestedQueries.slice(0, index), ...nestedQueries.slice(index + 1)];
    onChange({ ...query, binaryQueries: updatedList });
  };

  return (
    <Stack direction="column" gap={1}>
      {nestedQueries.map((nestedQuery, index) => (
        <NestedQuery
          key={index.toString()}
          nestedQuery={nestedQuery}
          index={index}
          onChange={onNestedQueryUpdate}
          datasource={datasource}
          onRemove={onRemove}
          onRunQuery={onRunQuery}
          showExplain={showExplain}
        />
      ))}
    </Stack>
  );
}

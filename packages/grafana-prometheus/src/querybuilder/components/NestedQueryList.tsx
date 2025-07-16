// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/NestedQueryList.tsx
import { Stack } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { PromVisualQuery, PromVisualQueryBinary } from '../types';

import { NestedQuery } from './NestedQuery';

interface NestedQueryListProps {
  query: PromVisualQuery;
  datasource: PrometheusDatasource;
  onChange: (query: PromVisualQuery) => void;
  onRunQuery: () => void;
  showExplain: boolean;
}

export function NestedQueryList(props: NestedQueryListProps) {
  const { query, datasource, onChange, onRunQuery, showExplain } = props;
  const nestedQueries = query.binaryQueries ?? [];

  const onNestedQueryUpdate = (index: number, update: PromVisualQueryBinary) => {
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

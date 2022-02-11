import React from 'react';
import { PromQueryEditorProps } from '../../components/types';
import PromQueryField from '../../components/PromQueryField';
import { testIds } from '../../components/PromQueryEditor';

export function PromQueryCodeEditor({ query, datasource, range, onRunQuery, onChange, data }: PromQueryEditorProps) {
  return (
    <PromQueryField
      datasource={datasource}
      query={query}
      range={range}
      onRunQuery={onRunQuery}
      onChange={onChange}
      history={[]}
      data={data}
      data-testid={testIds.editor}
    />
  );
}

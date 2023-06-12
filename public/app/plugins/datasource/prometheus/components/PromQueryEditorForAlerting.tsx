import React from 'react';

import PromQueryField from './PromQueryField';
import { PromQueryEditorProps } from './types';

export function PromQueryEditorForAlerting(props: PromQueryEditorProps) {
  const { datasource, query, range, data, onChange, onRunQuery } = props;

  return (
    <PromQueryField
      datasource={datasource}
      query={query}
      onRunQuery={onRunQuery}
      onChange={onChange}
      history={[]}
      range={range}
      data={data}
      data-testid={testIds.editor}
    />
  );
}

export const testIds = {
  editor: 'prom-editor-cloud-alerting',
};

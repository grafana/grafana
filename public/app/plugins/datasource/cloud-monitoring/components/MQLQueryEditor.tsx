import * as React from 'react';

import { TextArea } from '@grafana/ui';

import { selectors } from '../e2e/selectors';

export interface Props {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  query: string;
}

export function MQLQueryEditor({ query, onChange, onRunQuery }: React.PropsWithChildren<Props>) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
      event.preventDefault();
      onRunQuery();
    }
  };

  return (
    <span data-testid={selectors.components.queryEditor.mqlMetricsQueryEditor.container.input}>
      <TextArea
        name="Query"
        className="slate-query-field"
        value={query}
        rows={10}
        placeholder="Enter a Cloud Monitoring MQL query (Run with Shift+Enter)"
        onBlur={onRunQuery}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </span>
  );
}

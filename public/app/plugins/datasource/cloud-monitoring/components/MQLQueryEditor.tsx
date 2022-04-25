import React from 'react';

import { TextArea } from '@grafana/ui';

export interface Props {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  query: string;
}

export function MQLQueryEditor({ query, onChange, onRunQuery }: React.PropsWithChildren<Props>) {
  const onKeyDown = (event: any) => {
    if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
      event.preventDefault();
      onRunQuery();
    }
  };

  return (
    <>
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
    </>
  );
}

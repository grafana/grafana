import { CodeEditor } from '@grafana/ui';
import React, { useCallback } from 'react';
import { AzureQueryEditorFieldProps } from '../../types';

const QueryField: React.FC<AzureQueryEditorFieldProps> = ({ query, onQueryChange }) => {
  const onChange = useCallback(
    (newQuery: string) => {
      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          query: newQuery,
        },
      });
    },
    [onQueryChange, query]
  );

  return (
    <CodeEditor
      value={query.azureLogAnalytics.query}
      language="kql"
      height={200}
      width="100%"
      showMiniMap={false}
      onBlur={onChange}
      onSave={onChange}
    />
  );
};

export default QueryField;

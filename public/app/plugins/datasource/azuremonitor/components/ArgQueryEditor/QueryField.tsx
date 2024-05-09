import React, { useCallback } from 'react';

import { CodeEditor } from '@grafana/ui';

// @todo: replace barrel import path
import { AzureQueryEditorFieldProps } from '../../types/index';

const QueryField = ({ query, onQueryChange }: AzureQueryEditorFieldProps) => {
  const onChange = useCallback(
    (newQuery: string) => {
      onQueryChange({
        ...query,
        azureResourceGraph: {
          ...query.azureResourceGraph,
          query: newQuery,
        },
      });
    },
    [onQueryChange, query]
  );

  return (
    <CodeEditor
      value={query.azureResourceGraph?.query ?? ''}
      language="kusto"
      height={200}
      width="100%"
      showMiniMap={false}
      onBlur={onChange}
      onSave={onChange}
    />
  );
};

export default QueryField;

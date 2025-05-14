import { useCallback } from 'react';

import { CodeEditor } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types';

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

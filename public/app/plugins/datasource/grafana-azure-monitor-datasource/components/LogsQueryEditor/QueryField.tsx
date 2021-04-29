import { CodeEditor, MonacoEditor } from '@grafana/ui';
import { Monaco } from '@grafana/ui/src/components/Monaco/types';
import React, { useCallback } from 'react';
import { AzureQueryEditorFieldProps } from '../../types';

const QueryField: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, onQueryChange }) => {
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

  const handleEditorMount = useCallback(
    (editor: MonacoEditor, monaco: Monaco) => {
      const schemaPromise = datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.workspace);

      // @ts-ignore - TODO: type kusto language being there maybe sometimes
      const kustoWorkerPromise = monaco.languages.kusto.getKustoWorker();

      Promise.all([kustoWorkerPromise, schemaPromise]).then(([kustoWorker, schema]) => {
        const model = editor.getModel();
        console.log({ model });
        model &&
          kustoWorker(model.uri).then((worker: any) => {
            console.log('schema', schema);
            worker.setSchema(schema, 'https://help.kusto.windows.net', 'Samples');
          });
      });
    },
    [datasource.azureLogAnalyticsDatasource, query.azureLogAnalytics.workspace]
  );

  return (
    <CodeEditor
      value={query.azureLogAnalytics.query}
      language="kusto"
      height={200}
      width="100%"
      showMiniMap={false}
      onBlur={onChange}
      onSave={onChange}
      onEditorDidMount={handleEditorMount}
    />
  );
};

export default QueryField;

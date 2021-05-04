import { CodeEditor, Monaco, MonacoEditor } from '@grafana/ui';
import { Deferred } from 'app/core/utils/deferred';
import React, { useCallback, useEffect, useRef } from 'react';
import { AzureQueryEditorFieldProps } from '../../types';

interface MonacoPromise {
  editor: MonacoEditor;
  monaco: Monaco;
}

interface MonacoLanguages {
  kusto: {
    getKustoWorker: () => Promise<
      (
        url: any
      ) => Promise<{
        setSchema: (schema: any, clusterUrl: string, name: string) => void;
      }>
    >;
  };
}

const QueryField: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, onQueryChange }) => {
  const monacoPromiseRef = useRef<Deferred<MonacoPromise>>();

  function getPromise() {
    if (!monacoPromiseRef.current) {
      monacoPromiseRef.current = new Deferred<MonacoPromise>();
    }

    return monacoPromiseRef.current.promise;
  }

  useEffect(() => {
    const promises = [
      datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.workspace),
      getPromise(),
    ] as const;

    Promise.all(promises).then(([schema, { monaco, editor }]) => {
      const languages = (monaco.languages as unknown) as MonacoLanguages;

      languages.kusto.getKustoWorker().then((kusto) => {
        const model = editor.getModel();
        if (!model || !schema) {
          return;
        }
        kusto(model.uri).then((worker) => {
          worker.setSchema(schema, 'https://help.kusto.windows.net', 'Samples');
        });
      });
    });
  }, [datasource.azureLogAnalyticsDatasource, query.azureLogAnalytics.workspace]);

  const handleEditorMount = useCallback((editor: MonacoEditor, monaco: Monaco) => {
    monacoPromiseRef.current?.resolve?.({ editor, monaco });
  }, []);

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

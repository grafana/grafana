import React, { useCallback, useEffect, useRef } from 'react';

import { CodeEditor, Monaco, MonacoEditor } from '@grafana/ui';
import { Deferred } from 'app/core/utils/deferred';

import { AzureQueryEditorFieldProps } from '../../types';

import { setKustoQuery } from './setQueryValue';

interface MonacoPromise {
  editor: MonacoEditor;
  monaco: Monaco;
}

interface MonacoLanguages {
  kusto: {
    getKustoWorker: () => Promise<
      (url: any) => Promise<{
        setSchema: (schema: any, clusterUrl: string, name: string) => void;
      }>
    >;
  };
}

const QueryField = ({ query, datasource, onQueryChange }: AzureQueryEditorFieldProps) => {
  const monacoPromiseRef = useRef<Deferred<MonacoPromise>>();
  function getPromise() {
    if (!monacoPromiseRef.current) {
      monacoPromiseRef.current = new Deferred<MonacoPromise>();
    }

    return monacoPromiseRef.current.promise;
  }

  useEffect(() => {
    if (!query.azureLogAnalytics?.resources || !query.azureLogAnalytics.resources.length) {
      return;
    }

    const promises = [
      datasource.azureLogAnalyticsDatasource.getKustoSchema(query.azureLogAnalytics.resources[0]),
      getPromise(),
    ] as const;

    // the kusto schema call might fail, but it's okay for that to happen silently
    Promise.all(promises).then(([schema, { monaco, editor }]) => {
      const languages = monaco.languages as unknown as MonacoLanguages;

      languages.kusto
        .getKustoWorker()
        .then((kusto) => {
          const model = editor.getModel();
          return model && kusto(model.uri);
        })
        .then((worker) => {
          worker?.setSchema(schema, 'https://help.kusto.windows.net', 'Samples');
        });
    });
  }, [datasource.azureLogAnalyticsDatasource, query.azureLogAnalytics?.resources]);

  const handleEditorMount = useCallback((editor: MonacoEditor, monaco: Monaco) => {
    monacoPromiseRef.current?.resolve?.({ editor, monaco });
  }, []);

  const onChange = useCallback(
    (newQuery: string) => {
      onQueryChange(setKustoQuery(query, newQuery));
    },
    [onQueryChange, query]
  );

  return (
    <CodeEditor
      value={query.azureLogAnalytics?.query ?? ''}
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

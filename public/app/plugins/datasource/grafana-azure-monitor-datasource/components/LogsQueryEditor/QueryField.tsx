import { CodeEditor } from '@grafana/ui';
import React, { useCallback } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { AzureQueryEditorFieldProps } from '../../types';

// @ts-ignore
import bridgeUrl from 'file-loader!@kusto/monaco-kusto/release/min/bridge.min.js';

// @ts-ignore
import kustoJsClientUrl from 'file-loader!@kusto/monaco-kusto/release/min/kusto.javascript.client.min.js';

// @ts-ignore
import newtonsoftJsonUrl from 'file-loader!@kusto/monaco-kusto/release/min/newtonsoft.json.min.js';

// @ts-ignore
import kustoLanguageBridgeUrl from 'file-loader!@kusto/monaco-kusto/release/min/Kusto.Language.Bridge.min.js';

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

  const handleEditorWillMount = useCallback((monacoApi: typeof monaco) => {
    console.log('handleEditorWillMount', monacoApi);

    console.log({ bridgeUrl, kustoJsClientUrl, newtonsoftJsonUrl, kustoLanguageBridgeUrl });

    const scripts = [
      [bridgeUrl, 'bridgeUrl'],
      [kustoJsClientUrl, 'kustoJsClientUrl'],
      [newtonsoftJsonUrl, 'newtonsoftJsonUrl'],
      [kustoLanguageBridgeUrl, 'kustoLanguageBridgeUrl'],
    ];

    const prescriptsPromise = scripts.reduce((promise, [scriptSrc, scriptName]) => {
      return promise.then(() => {
        return new Promise((resolve, reject) => {
          console.log('Loading', scriptName, scriptSrc);
          const script = document.createElement('script');
          script.setAttribute('data-name', scriptName);
          script.src = scriptSrc;
          script.onload = () => resolve();
          script.onerror = (err) => reject(err);
          document.body.appendChild(script);
        });
      });
    }, Promise.resolve());

    prescriptsPromise
      .then(() => {
        console.log('kusto deps loaded, loading monaco.contribution');
        return import('@kusto/monaco-kusto/release/esm/monaco.contribution');
      })
      .then((contribution) => {
        console.log('🤲', contribution);
        monaco.editor.setTheme('kusto-dark2');
      });
  }, []);

  return (
    <CodeEditor
      value={query.azureLogAnalytics.query}
      language="kusto"
      height={200}
      width="100%"
      showMiniMap={false}
      onBlur={onChange}
      onSave={onChange}
      editorWillMount={handleEditorWillMount}
    />
  );
};

export default QueryField;

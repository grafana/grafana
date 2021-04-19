import { CodeEditor } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { AzureQueryEditorFieldProps } from '../../types';

// @ts-ignore
import KustoWorker from 'worker-loader!@kusto/monaco-kusto/release/esm/kusto.worker.js';

// @ts-ignore
import bridgeUrl from '!file-loader!@kusto/monaco-kusto/release/min/bridge.min.js';

// @ts-ignore
import kustoJsClientUrl from '!file-loader!@kusto/monaco-kusto/release/min/kusto.javascript.client.min.js';

// @ts-ignore
import newtonsoftJsonUrl from '!file-loader!@kusto/monaco-kusto/release/min/newtonsoft.json.min.js';

// @ts-ignore
import kustoLanguageBridgeUrl from '!file-loader!@kusto/monaco-kusto/release/min/Kusto.Language.Bridge.min.js';

function loadScript(scriptEl: HTMLScriptElement) {
  return new Promise((resolve, reject) => {
    scriptEl.onload = (ev) => resolve(ev);
    scriptEl.onerror = (err) => reject(err);
    document.body.appendChild(scriptEl);
  });
}

const QueryField: React.FC<AzureQueryEditorFieldProps> = ({ query, onQueryChange }) => {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    const scripts = [
      [bridgeUrl, 'bridgeUrl'],
      [kustoJsClientUrl, 'kustoJsClientUrl'],
      [newtonsoftJsonUrl, 'newtonsoftJsonUrl'],
      [kustoLanguageBridgeUrl, 'kustoLanguageBridgeUrl'],
    ];

    const prescriptsPromise = scripts.reduce(async (promise, [scriptSrc, scriptName]) => {
      await promise;
      console.log('Loading', scriptName, scriptSrc);
      const script = document.createElement('script');
      script.setAttribute('data-name', scriptName);
      script.src = scriptSrc;
      return await loadScript(script);
    }, Promise.resolve());

    prescriptsPromise.then(() => setScriptsLoaded(true));
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

  const handleEditorWillMount = useCallback((monacoApi: typeof monaco) => {
    // const loadMonacoKusto = () => {
    //   const script = document.createElement('script');
    //   script.innerHTML = `require(['vs/language/kusto/monaco.contribution'], function() {
    //       document.dispatchEvent(new Event('kusto_init'));
    //     });
    //   `;

    //   return loadScript(script);
    // };

    // // @ts-ignore
    // window.MonacoEnvironment = window.MonacoEnvironment ?? {};

    // // @ts-ignore
    // window.MonacoEnvironment.getWorker = function (moduleId: string, label: string) {
    //   // eslint-disable-next-line no-console
    //   console.trace('MonacoEnvironment.getWorker');
    //   console.log('MonacoEnvironment.getWorker', { moduleId, label });
    //   if (label === 'kusto') {
    //     console.log('returning KustoWorker', KustoWorker);
    //     return new KustoWorker();
    //   }
    // };

    console.log('handleEditorWillMount', monacoApi);

    console.log({ bridgeUrl, kustoJsClientUrl, newtonsoftJsonUrl, kustoLanguageBridgeUrl });

    // const prescriptsPromise = Promise.resolve();

    // prescriptsPromise
    //   .then(() => {
    //     console.log('kusto deps loaded, loading monaco.contribution');
    //     // return import('@kusto/monaco-kusto/release/esm/monaco.contribution');
    //     // return loadMonacoKusto();
    //   })
    //   .then((contribution: any) => {
    //     console.log('🤲', contribution);
    //     // monaco.editor.setTheme('kusto-dark2');
    //   });
  }, []);

  return scriptsLoaded ? (
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
  ) : (
    <div>loading deps...</div>
  );
};

export default QueryField;

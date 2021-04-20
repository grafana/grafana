import { CodeEditor } from '@grafana/ui';
import React, { useCallback } from 'react';
import { AzureQueryEditorFieldProps } from '../../types';

import * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

// @ts-ignore
import bridgeUrl from 'file-loader!@kusto/monaco-kusto/release/min/bridge.min.js';

// @ts-ignore
import kustoJsClientUrl from 'file-loader!@kusto/monaco-kusto/release/min/kusto.javascript.client.min.js';

// @ts-ignore
import newtonsoftJsonUrl from 'file-loader!@kusto/monaco-kusto/release/min/newtonsoft.json.min.js';

// @ts-ignore
import kustoLanguageBridgeUrl from 'file-loader!@kusto/monaco-kusto/release/min/Kusto.Language.Bridge.min.js';

function loadScript(scriptEl: HTMLScriptElement) {
  return new Promise((resolve, reject) => {
    scriptEl.onload = (ev) => resolve(ev);
    scriptEl.onerror = (err) => reject(err);
    document.body.appendChild(scriptEl);
  });
}

const loadMonacoKusto = () => {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    window.__monacoKustoResolvePromise = resolve;
    const script = document.createElement('script');
    script.innerHTML = `require(['vs/language/kusto/monaco.contribution'], function() {
      window.__monacoKustoResolvePromise();
  });
  `;
    return document.body.appendChild(script);
  });
};

const QueryField: React.FC<AzureQueryEditorFieldProps> = ({ query, onQueryChange }) => {
  const beforeMount = useCallback((monaco: typeof Monaco) => {
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

    prescriptsPromise.then(loadMonacoKusto);
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
      height={800}
      width="100%"
      showMiniMap={false}
      onBlur={onChange}
      onSave={onChange}
      onEditorWillMount={beforeMount}
    />
  );
};

export default QueryField;

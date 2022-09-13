import { css } from '@emotion/css';
import type { languages } from 'monaco-editor';
import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Monaco, useStyles2, monacoTypes } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';

import { CompletionProvider } from './autocomplete';
import { languageDefinition } from './traceql';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onRunQuery: () => void;
  datasource: TempoDatasource;
}

export function TraceQLEditor(props: Props) {
  const { onRunQuery } = props;
  const setupAutocompleteFn = useAutocomplete(props.datasource);
  const styles = useStyles2(getStyles);
  return (
    <CodeEditor
      value={props.value}
      language={langId}
      onBlur={props.onChange}
      height={'30px'}
      containerStyles={styles.queryField}
      monacoOptions={{
        folding: false,
        fontSize: 14,
        lineNumbers: 'off',
        overviewRulerLanes: 0,
        renderLineHighlight: 'none',
        scrollbar: {
          vertical: 'hidden',
          verticalScrollbarSize: 8, // used as "padding-right"
          horizontal: 'hidden',
          horizontalScrollbarSize: 0,
        },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
      }}
      onBeforeEditorMount={ensureTraceQL}
      onEditorDidMount={(editor, monaco) => {
        setupAutocompleteFn(editor, monaco);
        setupActions(editor, monaco, onRunQuery);
      }}
    />
  );
}

function setupActions(editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco, onRunQuery: () => void) {
  editor.addAction({
    id: 'run-query',
    label: 'Run Query',

    keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],

    contextMenuGroupId: 'navigation',

    contextMenuOrder: 1.5,

    run: function () {
      onRunQuery();
    },
  });
}

/**
 * Hook that returns function that will set up monaco autocomplete for the label selector
 * @param datasource
 */
function useAutocomplete(datasource: TempoDatasource) {
  // We need the provider ref so we can pass it the label/values data later. This is because we run the call for the
  // values here but there is additional setup needed for the provider later on. We could run the getSeries() in the
  // returned function but that is run after the monaco is mounted so would delay the request a bit when it does not
  // need to.
  const providerRef = useRef<CompletionProvider>(
    new CompletionProvider({ languageProvider: datasource.languageProvider })
  );

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start();
        const tags = datasource.languageProvider.getTags();

        if (tags) {
          providerRef.current.setTags(tags);
        }
      } catch (error) {
        if (error instanceof Error) {
          dispatch(notifyApp(createErrorNotification('Error', error)));
        }
      }
    };
    fetchTags();
  }, [datasource]);

  const autocompleteDisposeFun = useRef<(() => void) | null>(null);
  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteDisposeFun.current?.();
    };
  }, []);

  // This should be run in monaco onEditorDidMount
  return (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    providerRef.current.editor = editor;
    providerRef.current.monaco = monaco;

    const { dispose } = monaco.languages.registerCompletionItemProvider(langId, providerRef.current);
    autocompleteDisposeFun.current = dispose;
  };
}

// we must only run the setup code once
let traceqlSetupDone = false;
const langId = 'traceql';

function ensureTraceQL(monaco: Monaco) {
  if (!traceqlSetupDone) {
    traceqlSetupDone = true;
    const { aliases, extensions, mimetypes, def } = languageDefinition;
    monaco.languages.register({ id: langId, aliases, extensions, mimetypes });
    monaco.languages.setMonarchTokensProvider(langId, def.language as languages.IMonarchLanguage);
    monaco.languages.setLanguageConfiguration(langId, def.languageConfiguration as languages.LanguageConfiguration);
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    queryField: css`
      border-radius: ${theme.shape.borderRadius()};
      border: 1px solid ${theme.components.input.borderColor};
      flex: 1;
    `,
  };
};

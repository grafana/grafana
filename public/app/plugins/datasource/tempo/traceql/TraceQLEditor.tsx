import { css } from '@emotion/css';
import type { languages } from 'monaco-editor';
import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, Monaco, monacoTypes, useTheme2 } from '@grafana/ui';

import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { TempoDatasource } from '../datasource';

import { CompletionProvider, CompletionType } from './autocomplete';
import { languageDefinition } from './traceql';

interface Props {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onRunQuery: () => void;
  datasource: TempoDatasource;
  readOnly?: boolean;
}

export function TraceQLEditor(props: Props) {
  const { onChange, onRunQuery, placeholder } = props;
  const setupAutocompleteFn = useAutocomplete(props.datasource);
  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);
  // work around the problem that `onEditorDidMount` is called once
  // and wouldn't get new version of onRunQuery
  const onRunQueryRef = useRef(onRunQuery);
  onRunQueryRef.current = onRunQuery;

  return (
    <CodeEditor
      value={props.value}
      language={langId}
      onBlur={onChange}
      onChange={onChange}
      containerStyles={styles.queryField}
      readOnly={props.readOnly}
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
        if (!props.readOnly) {
          setupAutocompleteFn(editor, monaco, setupRegisterInteractionCommand(editor));
          setupActions(editor, monaco, () => onRunQueryRef.current());
          setupPlaceholder(editor, monaco, styles);
        }
        setupAutoSize(editor);
      }}
    />
  );
}

function setupPlaceholder(editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco, styles: EditorStyles) {
  const placeholderDecorators = [
    {
      range: new monaco.Range(1, 1, 1, 1),
      options: {
        className: styles.placeholder, // The placeholder text is in styles.placeholder
        isWholeLine: true,
      },
    },
  ];

  let decorators: string[] = [];

  const checkDecorators = (): void => {
    const model = editor.getModel();

    if (!model) {
      return;
    }

    const newDecorators = model.getValueLength() === 0 ? placeholderDecorators : [];
    decorators = model.deltaDecorations(decorators, newDecorators);
  };

  checkDecorators();
  editor.onDidChangeModelContent(checkDecorators);
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

function setupRegisterInteractionCommand(editor: monacoTypes.editor.IStandaloneCodeEditor): string | null {
  return editor.addCommand(0, function (_, label, type: CompletionType) {
    const properties: Record<string, unknown> = { datasourceType: 'tempo', type };
    // Filter out the label for TAG_VALUE completions to avoid potentially exposing sensitive data
    if (type !== 'TAG_VALUE') {
      properties.label = label;
    }
    reportInteraction('grafana_traces_traceql_completion', properties);
  });
}

function setupAutoSize(editor: monacoTypes.editor.IStandaloneCodeEditor) {
  const container = editor.getDomNode();
  const updateHeight = () => {
    if (container) {
      const contentHeight = Math.min(1000, editor.getContentHeight());
      const width = parseInt(container.style.width, 10);
      container.style.width = `${width}px`;
      container.style.height = `${contentHeight}px`;
      editor.layout({ width, height: contentHeight });
    }
  };
  editor.onDidContentSizeChange(updateHeight);
  updateHeight();
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
  return (
    editor: monacoTypes.editor.IStandaloneCodeEditor,
    monaco: Monaco,
    registerInteractionCommandId: string | null
  ) => {
    providerRef.current.editor = editor;
    providerRef.current.monaco = monaco;
    providerRef.current.setRegisterInteractionCommandId(registerInteractionCommandId);

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

interface EditorStyles {
  placeholder: string;
  queryField: string;
}

const getStyles = (theme: GrafanaTheme2, placeholder: string): EditorStyles => {
  return {
    queryField: css`
      border-radius: ${theme.shape.borderRadius()};
      border: 1px solid ${theme.components.input.borderColor};
      flex: 1;
    `,
    placeholder: css`
      ::after {
        content: '${placeholder}';
        font-family: ${theme.typography.fontFamilyMonospace};
        opacity: 0.3;
      }
    `,
  };
};

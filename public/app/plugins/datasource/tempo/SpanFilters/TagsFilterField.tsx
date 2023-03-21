import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Monaco, monacoTypes, useTheme2 } from '@grafana/ui';
import { TraceKeyValuePair } from 'app/features/explore/TraceView/components/types';

import { languageDefinition } from '../QueryEditor/TagsField/syntax';

import { CompletionProvider } from './autocomplete';

interface Props {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  tags: TraceKeyValuePair[];
}

export function TagsFilterField(props: Props) {
  const { onChange, placeholder } = props;
  const setupAutocompleteFn = useAutocomplete(props.tags);
  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);

  return (
    <CodeEditor
      value={props.value}
      language={langId}
      onChange={v => {
        onChange(v);
      }}
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
        setupPlaceholder(editor, monaco, styles);
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
 * @param tags
 */
function useAutocomplete(tags: TraceKeyValuePair[]) {
  const providerRef = useRef<CompletionProvider>(new CompletionProvider({ tagValues: tags }));

  useEffect(() => {
    if (tags) {
      providerRef.current.setTags(['joe', 'joseph', 'john']);
    }
  }, [tags]);

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
let setupDone = false;
const langId = 'tagsFilterfield';

function ensureTraceQL(monaco: Monaco) {
  if (!setupDone) {
    setupDone = true;
    const { aliases, extensions, mimetypes, def } = languageDefinition;
    monaco.languages.register({ id: langId, aliases, extensions, mimetypes });
    monaco.languages.setMonarchTokensProvider(langId, def.language);
    monaco.languages.setLanguageConfiguration(langId, def.languageConfiguration);
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

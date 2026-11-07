import { css, cx } from '@emotion/css';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2, monacoLanguageRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import { ReactMonacoEditorLazy } from './ReactMonacoEditorLazy';
import { registerSuggestions } from './suggestions';
import { type CodeEditorProps, type Monaco, type MonacoEditor as MonacoEditorType, type MonacoOptions } from './types';

/**
 * Monaco Code editor.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-codeeditor--docs
 */
export const CodeEditor = memo(function CodeEditor(props: CodeEditorProps) {
  const {
    language,
    width,
    height,
    showMiniMap,
    showLineNumbers,
    readOnly,
    wordWrap,
    monacoOptions,
    getSuggestions,
    onBlur,
    onFocus,
    onBeforeEditorMount,
    onEditorDidMount,
  } = props;
  const theme = useTheme2();
  const editorRef = useRef<MonacoEditorType | null>(null);
  const listenersRef = useRef<monacoType.IDisposable[]>([]);
  const [monaco, setMonaco] = useState<Monaco>();
  const [modelId, setModelId] = useState<string>();

  // Monaco's listeners are registered once on mount, so they read the latest props through this ref.
  // Layout effect so it's updated before the Monaco wrapper's passive effects push value changes into the editor.
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!monaco || !modelId || !getSuggestions) {
      return;
    }
    const completionCancel = registerSuggestions(monaco, language, getSuggestions, modelId);
    return () => completionCancel?.dispose();
  }, [monaco, modelId, language, getSuggestions]);

  // init() creates a worker, so only run it when the language changes, never on mount
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      prevLanguageRef.current = language;
      monacoLanguageRegistry.getIfExists(language)?.init();
    }
  }, [language]);

  useLayoutEffect(() => {
    return () => {
      // keepCurrentModel keeps the model alive after unmount, so its listeners must be disposed here
      listenersRef.current.forEach((listener) => listener.dispose());
      listenersRef.current = [];
      propsRef.current.onEditorWillUnmount?.();
    };
  }, []);

  const getEditorValue = () => editorRef.current?.getValue() ?? '';

  const handleOnMount = (editor: MonacoEditorType, monacoInstance: Monaco) => {
    editorRef.current = editor;
    // Set together here rather than monaco in beforeMount, which runs a commit earlier and would cost an extra render
    setMonaco(monacoInstance);
    const model = editor.getModel();
    if (model) {
      setModelId(model.id);
      listenersRef.current.push(model.onDidChangeContent(() => propsRef.current.onChange?.(editor.getValue())));
    }

    // Save when pressing Ctrl+S or Cmd+S
    listenersRef.current.push(
      editor.onKeyDown((e: monacoType.IKeyboardEvent) => {
        if (e.keyCode === monacoInstance.KeyCode.KeyS && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          propsRef.current.onSave?.(editor.getValue());
        }
      })
    );

    onEditorDidMount?.(editor, monacoInstance);
  };

  const { alwaysConsumeMouseWheel, ...restMonacoOptions } = monacoOptions ?? {};

  const value = props.value ?? '';
  const longText = value.length > 100;

  const styles = useStyles2(getStyles);

  const options: MonacoOptions = {
    wordWrap: wordWrap ? 'on' : 'off',
    tabSize: 2,
    codeLens: false,
    contextmenu: false,
    minimap: {
      enabled: longText && showMiniMap,
      renderCharacters: false,
    },

    readOnly,
    lineNumbersMinChars: 4,
    lineDecorationsWidth: 1 * theme.spacing.gridSize,
    overviewRulerBorder: false,
    automaticLayout: true,
    padding: {
      top: 0.5 * theme.spacing.gridSize,
      bottom: 0.5 * theme.spacing.gridSize,
    },
    fixedOverflowWidgets: true, // Ensures suggestions menu is drawn on top

    scrollbar: {
      alwaysConsumeMouseWheel: alwaysConsumeMouseWheel ?? false,
    },
  };

  if (!showLineNumbers) {
    options.glyphMargin = false;
    options.folding = false;
    options.lineNumbers = 'off';
    options.lineNumbersMinChars = 0;
  }

  return (
    <div
      className={cx(styles.container, props.containerStyles)}
      onFocus={() => onFocus?.(getEditorValue())}
      onBlur={() => onBlur?.(getEditorValue())}
      data-testid={selectors.components.CodeEditor.container}
    >
      <ReactMonacoEditorLazy
        width={width}
        height={height}
        language={language}
        value={value}
        options={{
          ...options,
          ...restMonacoOptions,
        }}
        beforeMount={onBeforeEditorMount}
        onMount={handleOnMount}
        keepCurrentModel={true}
      />
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.components.input.borderColor}`,
      overflow: 'hidden',
    }),
  };
};

import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Monaco, CodeEditorMonacoOptions, monacoTypes, useStyles2, Box } from '@grafana/ui';

interface Props {
  value?: string;
  language?: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
  onFocusPopulate?: (currentValue: string) => string | undefined;
  onBeforeEditorMount?: (monaco: Monaco) => void;
  onEditorDidMount?: (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => void;
  onFormatReady?: (formatFn: () => void) => void;
}

// This offset was chosen by testing to match Prometheus behavior
const EDITOR_HEIGHT_OFFSET = 2;
export type RawQueryEditorProps = Props;

export function RawQueryEditor({
  value,
  language = 'json',
  onChange,
  onRunQuery,
  onFocusPopulate,
  onBeforeEditorMount,
  onEditorDidMount,
  onFormatReady,
}: Props) {
  const styles = useStyles2(getStyles);
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onRunQueryRef = useRef(onRunQuery);
  const onFocusPopulateRef = useRef(onFocusPopulate);
  const onEditorDidMountRef = useRef(onEditorDidMount);

  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  useEffect(() => {
    onFocusPopulateRef.current = onFocusPopulate;
  }, [onFocusPopulate]);

  useEffect(() => {
    onEditorDidMountRef.current = onEditorDidMount;
  }, [onEditorDidMount]);

  const handleEditorDidMount = useCallback(
    (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;

      // Add keyboard shortcut for running query (Ctrl/Cmd+Enter)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunQueryRef.current();
      });

      editor.onDidFocusEditorText(() => {
        const currentValue = editor.getValue();
        const populatedValue = onFocusPopulateRef.current?.(currentValue);
        if (!populatedValue || currentValue.trim() !== '') {
          return;
        }

        // Populate editor text without dispatching query changes on focus.
        editor.setValue(populatedValue);
      });

      // Make the editor resize itself so that the content fits (grows taller when necessary)
      // this code comes from the Prometheus query editor.
      // We may wish to consider abstracting it into the grafana/ui repo in the future
      const updateElementHeight = () => {
        const containerDiv = containerRef.current;
        if (containerDiv !== null) {
          const pixelHeight = editor.getContentHeight();
          containerDiv.style.height = `${pixelHeight + EDITOR_HEIGHT_OFFSET}px`;
          const pixelWidth = containerDiv.clientWidth;
          editor.layout({ width: pixelWidth, height: pixelHeight });
        }
      };

      editor.onDidContentSizeChange(updateElementHeight);
      updateElementHeight();

      onEditorDidMountRef.current?.(editor, monaco);
      onFormatReady?.(() => {
        editorRef.current?.getAction('editor.action.formatDocument')?.run();
      });
    },
    [onFormatReady]
  );

  const handleQueryChange = useCallback(
    (newValue: string) => {
      if (!newValue) {
        return;
      }
      onChange(newValue);
    },
    [onChange]
  );

  const monacoOptions: CodeEditorMonacoOptions = {
    fontSize: 14,
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    fixedOverflowWidgets: true,
    folding: true,
    renderLineHighlight: 'all',
    suggest: {
      showProperties: true,
      showMethods: true,
      showKeywords: true,
    },
    quickSuggestions: {
      other: true,
      strings: true,
    },
  };

  return (
    <Box>
      <div ref={containerRef} className={styles.editorContainer}>
        <CodeEditor
          value={value ?? ''}
          language={language}
          width="100%"
          onBlur={handleQueryChange}
          monacoOptions={monacoOptions}
          onEditorDidMount={handleEditorDidMount}
          onBeforeEditorMount={onBeforeEditorMount}
        />
      </div>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  editorContainer: css({
    width: '100%',
    overflow: 'hidden',
  }),
});

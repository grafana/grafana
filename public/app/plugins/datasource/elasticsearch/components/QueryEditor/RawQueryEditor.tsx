import { css } from '@emotion/css';
import { useCallback, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Monaco, CodeEditorMonacoOptions, monacoTypes, useStyles2, Button, Stack, Box } from '@grafana/ui';

interface Props {
  value?: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
}

// This offset was chosen by testing to match Prometheus behavior
const EDITOR_HEIGHT_OFFSET = 2;

export function RawQueryEditor({ value, onChange, onRunQuery }: Props) {
  const styles = useStyles2(getStyles);
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleEditorDidMount = useCallback(
    (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;

      // Add keyboard shortcut for running query (Ctrl/Cmd+Enter)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunQuery();
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
    },
    [onRunQuery]
  );

  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

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
          language="json"
          width="100%"
          onBlur={handleQueryChange}
          monacoOptions={monacoOptions}
          onEditorDidMount={handleEditorDidMount}
        />
      </div>
      <div className={styles.footer}>
        <Stack gap={1}>
          <Button
            size="sm"
            variant="secondary"
            icon="brackets-curly"
            onClick={handleFormat}
            tooltip="Format query (Shift+Alt+F)"
          >
            Format
          </Button>
        </Stack>
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
  footer: css({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0.5, 0),
  }),
});

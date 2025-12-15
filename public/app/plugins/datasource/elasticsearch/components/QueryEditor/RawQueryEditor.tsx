import { css } from '@emotion/css';
import { useCallback, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Monaco, CodeEditorMonacoOptions, monacoTypes, useStyles2, Button, Stack, Box } from '@grafana/ui';

interface Props {
  value?: string;
  onChange: (value: string) => void;
  onRunQuery: () => void;
}

export function RawQueryEditor({ value, onChange, onRunQuery }: Props) {
  const styles = useStyles2(getStyles);
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = useCallback(
    (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;

      // Add keyboard shortcut for running query (Ctrl/Cmd+Enter)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunQuery();
      });
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
      <div className={styles.header}>
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
          <Button size="sm" variant="primary" icon="play" onClick={onRunQuery} tooltip="Run query (Ctrl/Cmd+Enter)">
            Run
          </Button>
        </Stack>
      </div>
      <CodeEditor
        value={value ?? ''}
        language="json"
        height={200}
        width="100%"
        onBlur={handleQueryChange}
        monacoOptions={monacoOptions}
        onEditorDidMount={handleEditorDidMount}
      />
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  header: css({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0.5, 0),
  }),
});

import { css } from '@emotion/css';
import { useCallback, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { CodeEditor, Monaco, monacoTypes, useStyles2, Button, Stack, Combobox } from '@grafana/ui';

import { ProcessAsType, RawQuery } from '../../dataquery.gen';

interface Props {
  value?: RawQuery;
  onChange: (value: RawQuery) => void;
  onRunQuery: () => void;
}

export function RawQueryEditor({ value, onChange, onRunQuery }: Props) {
  const styles = useStyles2(getStyles);
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount = useCallback((editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcut for running query (Ctrl/Cmd+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunQuery();
    });

    // Format the document on mount if there's content
    if (value) {
      setTimeout(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }
  }, [onRunQuery, value]);

  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  const handleQueryChange = useCallback((newValue: string) => {
    if (!newValue) {
      return;
    }
    onChange({...value, query: newValue});
  }, [onChange, value]);

  const handleQueryTypeChange = useCallback((newValue: ProcessAsType) => {
    if (!newValue) {
      return;
    }
    onChange({...value, processAs: newValue});
  }, [onChange, value]);

  return (
    <div className={styles.container}>
    <EditorRows>
        <EditorRow>
          {/* define query response processing */}
          <EditorField label="Process query as" tooltip="Define how the query response should be processed.">
            <Combobox<ProcessAsType>
              options={[
                { label: 'Metrics', value: ProcessAsType.Metrics},
                { label: 'Logs', value: ProcessAsType.Logs },
                { label: 'Raw data', value: ProcessAsType.Raw_data },
              ]}
              onChange={(e) => handleQueryTypeChange(e.value)}
              value={value?.processAs}
            />
          </EditorField>
          {/* {props.query.rawQuerySettings?.processAs === 'metrics' && (
            <EditorRow>
              <EditorField label="Aggregation IDs" description="Enter the aggregation ID(s) to be processed into data frames. In case of multiple, separate IDs with a comma">
                <Input
                  onChange={(e) =>
                    props.onChange({
                      ...props.query,
                      rawQuerySettings: { ...props.query.rawQuerySettings, valueField: e.currentTarget.value },
                    })
                  }
                />
              </EditorField>
            </EditorRow>
          )} */}
        </EditorRow>
      </EditorRows>
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
          <Button
            size="sm"
            variant="primary"
            icon="play"
            onClick={onRunQuery}
            tooltip="Run query (Ctrl/Cmd+Enter)"
          >
            Run
          </Button>
        </Stack>
      </div>
      <CodeEditor
        value={value?.query ?? DEFAULT_RAW_QUERY}
        language="json"
        height={200}
        width="100%"
        onBlur={handleQueryChange}
        monacoOptions={{
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
        }}
        onEditorDidMount={handleEditorDidMount}
      />
    </div>
  );
}

const DEFAULT_RAW_QUERY = `{
  "query": {
    "bool": {
      "must": [
        {
          "range": {
            "@timestamp": {
              "gte": "$__from",
              "lte": "$__to",
              "format": "epoch_millis"
            }
          }
        }
      ]
    }
  },
  "size": 500
}`;

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

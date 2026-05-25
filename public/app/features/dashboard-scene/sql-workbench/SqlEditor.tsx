import { css } from '@emotion/css';
import type * as monacoNS from 'monaco-editor';
import { type MutableRefObject, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, type Monaco, type MonacoEditor, useStyles2 } from '@grafana/ui';

import { AiExplainerPopover } from './AiExplainerPopover';
import { mockSchema } from './schema';


export const DEFAULT_SQL = `SELECT
  le,
  native(histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m])))
    AS p95_latency
FROM http_server_requests_seconds_bucket
WHERE timestamp >= UNIX_TIMESTAMP(NOW() - INTERVAL 1 HOUR)
  AND timestamp <  UNIX_TIMESTAMP(NOW())
GROUP BY le`;

let nativeStylesInjected = false;

function injectNativeBlockStyles() {
  if (nativeStylesInjected) {
    return;
  }
  nativeStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'sql-proto-native-styles';
  style.textContent = `
    .sql-proto-native-block {
      background: rgba(120, 80, 200, 0.18) !important;
      border-radius: 3px;
      border-bottom: 2px solid rgba(120, 80, 200, 0.6);
    }
    .sql-proto-ds-name {
      color: rgba(190, 140, 255, 1) !important;
    }
  `;
  document.head.appendChild(style);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRunQuery?: () => void;
  readOnly?: boolean;
  height?: string | number;
  onCursorLineChange?: (line: number) => void;
  setCursorLineRef?: MutableRefObject<((line: number) => void) | null>;
}

type DecorationsCollection = monacoNS.editor.IEditorDecorationsCollection;

export function SqlEditor({
  value,
  onChange,
  onRunQuery,
  readOnly = false,
  height = '100%',
  onCursorLineChange,
  setCursorLineRef,
}: Props) {
  const styles = useStyles2(getStyles);
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<DecorationsCollection | null>(null);
  const dsNamesDecorationsRef = useRef<DecorationsCollection | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [aiMode, setAiMode] = useState<'explain' | 'generate' | null>(null);

  const applyNativeDecorations = (editor: MonacoEditor, monaco: Monaco) => {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const text = model.getValue();
    const decorations: monacoNS.editor.IModelDeltaDecoration[] = [];

    const nativeRegex = /native\s*\(/gi;
    let match;
    while ((match = nativeRegex.exec(text)) !== null) {
      const start = match.index;
      let depth = 0;
      let end = start;
      for (let i = start + match[0].length - 1; i < text.length; i++) {
        if (text[i] === '(') {
          depth++;
        } else if (text[i] === ')') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }

      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(end + 1);

      decorations.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: {
          inlineClassName: 'sql-proto-native-block',
          hoverMessage: { value: '**PromQL native block** — executed by the Prometheus engine' },
        },
      });
    }

    if (decorationsRef.current) {
      decorationsRef.current.set(decorations);
    } else {
      decorationsRef.current = editor.createDecorationsCollection(decorations);
    }
  };

  const applyDsNameDecorations = (editor: MonacoEditor, monaco: Monaco) => {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    const text = model.getValue();
    const dsDecorations: monacoNS.editor.IModelDeltaDecoration[] = [];
    const dsRegex = /`(prometheus|loki)(?:::|`)/gi;
    let dsMatch;
    while ((dsMatch = dsRegex.exec(text)) !== null) {
      const start = dsMatch.index + 1; // skip opening backtick
      const name = dsMatch[1];
      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(start + name.length);
      dsDecorations.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: { inlineClassName: 'sql-proto-ds-name' },
      });
    }
    if (dsNamesDecorationsRef.current) {
      dsNamesDecorationsRef.current.set(dsDecorations);
    } else {
      dsNamesDecorationsRef.current = editor.createDecorationsCollection(dsDecorations);
    }
  };

  const setupAutocomplete = (monaco: Monaco) => {
    const tables = mockSchema.flatMap((ds) => ds.tables.map((t) => t.name));
    const allColumns = mockSchema.flatMap((ds) => ds.tables.flatMap((t) => t.columns.map((c) => c.name)));

    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const linePrefix = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const range: monacoNS.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const isAfterFrom = /\bfrom\s+\w*$/i.test(linePrefix);
        const isInsideNative = /native\s*\([^)]*$/.test(
          model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          })
        );

        const suggestions: monacoNS.languages.CompletionItem[] = [];

        if (isAfterFrom) {
          tables.forEach((t) => {
            suggestions.push({
              label: t,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: t,
              range,
              detail: 'Prometheus metric',
            });
          });
        } else if (isInsideNative) {
          [
            'histogram_quantile',
            'rate',
            'irate',
            'increase',
            'avg_over_time',
            'sum_over_time',
            'label_replace',
          ].forEach((fn) => {
            suggestions.push({
              label: fn,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `${fn}(`,
              range,
              detail: 'PromQL function',
            });
          });
        } else {
          allColumns.forEach((c) => {
            suggestions.push({
              label: c,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: c,
              range,
            });
          });
        }

        return { suggestions };
      },
    });
  };

  const handleEditorMount = (editor: MonacoEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    injectNativeBlockStyles();
    setupAutocomplete(monaco);
    applyNativeDecorations(editor, monaco);
    applyDsNameDecorations(editor, monaco);

    editor.onDidChangeModelContent(() => {
      applyNativeDecorations(editor, monaco);
      applyDsNameDecorations(editor, monaco);
    });

    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection();
      if (sel && !sel.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(sel) ?? '';
        setSelectedText(text.trim());
      } else {
        setSelectedText('');
      }
    });

    editor.onDidChangeCursorPosition((e) => {
      onCursorLineChange?.(e.position.lineNumber);
    });

    if (setCursorLineRef) {
      setCursorLineRef.current = (line: number) => {
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.revealLineInCenter(line);
        editor.focus();
      };
    }

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunQuery?.();
    });
  };

  const insertAtCursor = (text: string) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return;
    }
    const selection = editor.getSelection();
    if (!selection) {
      return;
    }
    editor.executeEdits('ai-insert', [{ range: selection, text }]);
    editor.focus();
  };

  useEffect(() => {
    return () => {
      decorationsRef.current?.clear();
      dsNamesDecorationsRef.current?.clear();
    };
  }, []);

  return (
    <div className={styles.root}>
      {selectedText && !aiMode && (
        <div className={styles.aiBar}>
          <span className={styles.selectionLabel}>
            <em>
              {selectedText.slice(0, 50)}
              {selectedText.length > 50 ? '…' : ''}
            </em>
          </span>
          <Button size="sm" variant="primary" fill="text" icon="comment-alt" onClick={() => setAiMode('explain')}>
            Explain
          </Button>
          <Button size="sm" variant="primary" fill="text" icon="pen" onClick={() => setAiMode('generate')}>
            Generate
          </Button>
        </div>
      )}
      <div className={styles.editorWrap}>
        <CodeEditor
          value={value}
          language="sql"
          onChange={onChange}
          onEditorDidMount={handleEditorMount}
          readOnly={readOnly}
          height="100%"
          containerStyles={styles.editorContainer}
          monacoOptions={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
      {aiMode && (
        <AiExplainerPopover
          selectedText={aiMode === 'generate' ? selectedText || 'SELECT ' : selectedText}
          mode={aiMode}
          onClose={() => setAiMode(null)}
          onInsert={(sql) => {
            insertAtCursor(sql);
            setAiMode(null);
          }}
        />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
    }),
    aiBar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25, 0.5, 0.25, 1.5),
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      borderLeft: `3px solid ${theme.colors.primary.border}`,
      flexWrap: 'wrap',
    }),
    selectionLabel: css({
      flex: 1,
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    editorWrap: css({
      flex: 1,
      minHeight: 0,
      position: 'relative',
    }),
    editorContainer: css({
      position: 'absolute',
      inset: 0,
    }),
  };
}

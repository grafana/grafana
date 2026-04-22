import { type SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { CodeEditor, type Monaco, type MonacoEditor } from '@grafana/ui';

import { ALLOWED_FUNCTIONS } from '../../utils/metaSqlExpr';

interface ColumnDefinition {
  name: string;
  completion?: string;
}

interface TableIdentifier {
  table?: string;
}

interface SQLEditorProps {
  query: string;
  width?: number;
  height?: number;
  refIds: Array<SelectableValue<string>>;
  onChange: (query: string) => void;
  formatter?: (query: string) => string;
  getFields: (identifier: TableIdentifier) => Promise<ColumnDefinition[]>;
  children?: (props: { formatQuery: () => void }) => ReactNode;
}

const SQL_LANGUAGE_ID = 'sql';

export function SQLEditor({ query, width, height, refIds, onChange, formatter, getFields, children }: SQLEditorProps) {
  const monacoRef = useRef<Monaco>();
  const completionProviderRef = useRef<{ dispose: () => void }>();
  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const formatQuery = useCallback(() => {
    onChange(formatter ? formatter(queryRef.current) : queryRef.current);
  }, [formatter, onChange]);

  const registerCompletionProvider = useCallback(
    (monaco: Monaco) => {
      completionProviderRef.current?.dispose();

      completionProviderRef.current = monaco.languages.registerCompletionItemProvider(SQL_LANGUAGE_ID, {
        triggerCharacters: [' ', '.', ','],
        provideCompletionItems: async (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const currentLineUntilCursor = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          const dottedTableMatch = /([A-Za-z_][\w]*)\.[A-Za-z_0-9]*$/.exec(currentLineUntilCursor);
          const contextTableMatch = /(?:from|join)\s+([A-Za-z_][\w]*)\s*$/i.exec(currentLineUntilCursor);
          const tableName = dottedTableMatch?.[1] ?? contextTableMatch?.[1];
          const suggestions = [];

          for (const refId of refIds) {
            const label = refId.label || refId.value;
            if (!label) {
              continue;
            }

            suggestions.push({
              label,
              insertText: label,
              kind: monaco.languages.CompletionItemKind.Variable,
              range,
            });
          }

          for (const fn of ALLOWED_FUNCTIONS) {
            suggestions.push({
              label: fn,
              insertText: `${fn}($1)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              kind: monaco.languages.CompletionItemKind.Function,
              range,
            });
          }

          if (tableName && config.featureToggles.sqlExpressionsColumnAutoComplete) {
            try {
              const columns = await getFields({ table: tableName });
              for (const column of columns) {
                suggestions.push({
                  label: column.name,
                  insertText: column.completion ?? column.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  range,
                });
              }
            } catch {
              // Ignore schema loading failures and keep refId/function autocomplete.
            }
          }

          return { suggestions };
        },
      });
    },
    [getFields, refIds]
  );

  useEffect(() => {
    if (monacoRef.current) {
      registerCompletionProvider(monacoRef.current);
    }
  }, [registerCompletionProvider]);

  useEffect(() => {
    return () => {
      completionProviderRef.current?.dispose();
    };
  }, []);

  return (
    <>
      <CodeEditor
        value={query}
        language={SQL_LANGUAGE_ID}
        width={width}
        height={height}
        showMiniMap={false}
        onBeforeEditorMount={(monaco) => {
          monacoRef.current = monaco;
        }}
        onEditorDidMount={(_editor: MonacoEditor, monaco: Monaco) => {
          monacoRef.current = monaco;
          registerCompletionProvider(monaco);
        }}
        onChange={(value) => onChange(value)}
      />
      {children?.({ formatQuery })}
    </>
  );
}

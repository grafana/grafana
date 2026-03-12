import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { keywordCompletionSource, MySQL, sql } from '@codemirror/lang-sql';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, Text } from '@codemirror/state';
import { oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import { EditorView, lineNumbers, ViewUpdate } from '@codemirror/view';
import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

// Hoisted — MySQL keywords and dialect don't change
const kwSource = keywordCompletionSource(MySQL, true);

export interface SQLEditorV2CompletionProvider {
  getTables: () => Promise<string[]>;
  getColumns: (table: string) => Promise<string[]>;
  getFunctions?: () => string[];
}

export interface SQLEditorV2LanguageDefinition {
  completionProvider?: SQLEditorV2CompletionProvider;
  formatter?: (query: string) => Promise<string>;
}

export interface SQLEditorV2Props {
  query: string;
  onChange?: (q: string, processQuery: boolean) => void;
  onBlur?: (text: string) => void;
  language?: SQLEditorV2LanguageDefinition;
  children?: (props: { formatQuery: () => void }) => React.ReactNode;
  width?: number;
  height?: number;
}

// Returns true if the cursor is in a table name position (after FROM or JOIN)
function isAfterFromOrJoin(doc: Text, pos: number): boolean {
  const textBefore = doc.sliceString(0, pos).replace(/\w*$/, '').trimEnd();
  return /\b(FROM|JOIN)$/i.test(textBefore);
}

// Extract table names from the FROM clause of the full query
function getFromTables(doc: Text): string[] {
  const text = doc.toString();
  return Array.from(text.matchAll(/\bFROM\s+(\w+)/gi), (m) => m[1]);
}

function makeCompletionSource(
  tables: string[],
  getColumns: (table: string) => Promise<string[]>,
  fnCompletions: Completion[]
) {
  const tableCompletions: Completion[] = tables.map((t) => ({ label: t, type: 'type' }));

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    if (isAfterFromOrJoin(context.state.doc, context.pos)) {
      return { from: word.from, options: tableCompletions };
    }

    // Fetch columns for tables referenced in FROM
    const fromTables = getFromTables(context.state.doc);
    const columnCompletions: Completion[] = (await Promise.all(fromTables.map(getColumns)))
      .flat()
      .map((col) => ({ label: col, type: 'property' }));

    // SQL keywords + functions + columns
    const kwResult = await kwSource(context);
    const extra = [...columnCompletions, ...fnCompletions];
    if (!kwResult) {
      return extra.length > 0 ? { from: word.from, options: extra } : null;
    }
    return { ...kwResult, options: [...kwResult.options, ...extra] };
  };
}

function buildSqlExtension(
  tables: string[],
  getColumns: (table: string) => Promise<string[]>,
  fnCompletions: Completion[]
) {
  return [
    sql({ dialect: MySQL }),
    autocompletion({ override: [makeCompletionSource(tables, getColumns, fnCompletions)], defaultKeymap: true }),
  ];
}

export function SQLEditorV2({ query, onChange, onBlur, language, children, width, height }: SQLEditorV2Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useLatest(onChange);
  const onBlurRef = useLatest(onBlur);
  const languageRef = useLatest(language);

  // Mount the editor once
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const sqlCompartment = new Compartment();

    const extensions = [
      lineNumbers(),
      // Start with no tables; reconfigured async once tables are fetched
      sqlCompartment.of(buildSqlExtension([], () => Promise.resolve([]), [])),
      theme.isDark ? oneDarkTheme : [],
      syntaxHighlighting(theme.isDark ? oneDarkHighlightStyle : defaultHighlightStyle),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString(), true);
        }
      }),
      EditorView.domEventHandlers({
        blur: (_, view) => {
          onBlurRef.current?.(view.state.doc.toString());
        },
      }),
      EditorView.theme({
        '&': { width: '100%', height: '100%', fontSize: '13px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-editor': { background: theme.components.input.background },
        '.cm-gutters': {
          background: theme.colors.background.secondary,
          borderRight: `1px solid ${theme.colors.border.weak}`,
        },
      }),
    ];

    const state = EditorState.create({ doc: query, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Async: fetch tables then reconfigure completion with real data
    const provider = languageRef.current?.completionProvider;
    if (provider) {
      provider.getTables().then((tables) => {
        const fnCompletions: Completion[] = (provider.getFunctions?.() ?? []).map((f) => ({
          label: f,
          type: 'function',
        }));
        if (viewRef.current) {
          viewRef.current.dispatch({
            effects: sqlCompartment.reconfigure(buildSqlExtension(tables, provider.getColumns, fnCompletions)),
          });
        }
      });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount once
  }, []);

  // Sync external query changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    if (view.state.doc.toString() !== query) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: query } });
    }
  }, [query]);

  const formatQuery = useCallback(async () => {
    const view = viewRef.current;
    if (!language?.formatter || !view) {
      return;
    }
    const formatted = await language.formatter(view.state.doc.toString());
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
    onChangeRef.current?.(formatted, true);
  }, [language, onChangeRef]);

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column' }}>
      <div className={styles.container} style={{ height }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {children?.({ formatQuery })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.components.input.borderColor}`,
    overflow: 'hidden',
    position: 'relative',
  }),
});

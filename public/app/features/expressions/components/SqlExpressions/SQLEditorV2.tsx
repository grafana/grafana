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

export interface SQLEditorV2CompletionProvider {
  getTables: () => Promise<string[]>;
  getColumns: (table: string) => Promise<string[]>;
  getFunctions?: () => string[];
}

export interface SQLEditorV2LanguageDefinition {
  id: string;
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
  // Strip the partial word being typed, then check what keyword precedes it
  const textBefore = doc.sliceString(0, pos).replace(/\w*$/, '').trimEnd();
  return /\b(FROM|JOIN)$/i.test(textBefore);
}

function makeCompletionSource(tables: string[], functions: string[]) {
  const tableCompletions: Completion[] = tables.map((t) => ({ label: t, type: 'type' }));
  const fnCompletions: Completion[] = functions.map((f) => ({ label: f, type: 'function' }));
  const kwSource = keywordCompletionSource(MySQL, true);

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    if (isAfterFromOrJoin(context.state.doc, context.pos)) {
      return { from: word.from, options: tableCompletions };
    }

    // Everywhere else: SQL keywords + functions
    const kwResult = kwSource(context);
    if (!kwResult) {
      return fnCompletions.length > 0 ? { from: word.from, options: fnCompletions } : null;
    }
    return { ...kwResult, options: [...kwResult.options, ...fnCompletions] };
  };
}

function buildSqlExtension(tables: string[], functions: string[]) {
  return [
    sql({ dialect: MySQL }),
    autocompletion({ override: [makeCompletionSource(tables, functions)], defaultKeymap: true }),
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
      // Start with no tables; reconfigured async once tables are fetched
      lineNumbers(),
      sqlCompartment.of(buildSqlExtension([], [])),
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
        const functions = provider.getFunctions?.() ?? [];
        if (viewRef.current) {
          viewRef.current.dispatch({
            effects: sqlCompartment.reconfigure(buildSqlExtension(tables, functions)),
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
      <div className={styles.container} style={{ width: '100%', height }}>
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

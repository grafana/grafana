import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { keywordCompletionSource, MySQL, sql } from '@codemirror/lang-sql';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, Text } from '@codemirror/state';
import { oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import { EditorView, lineNumbers, Panel, showPanel, ViewUpdate } from '@codemirror/view';
import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLatest } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { SqlExpressionQuery } from '../../types';
import { QueryToolbox } from '../QueryToolbox';

// Hoisted — MySQL keywords and dialect don't change
const kwSource = keywordCompletionSource(MySQL, true);

export interface SQLEditorV2CompletionProvider {
  getTables: () => Promise<string[]>;
  getColumns: (table: string) => Promise<Array<{ label: string; apply?: string }>>;
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
  toolboxProps?: { query: SqlExpressionQuery };
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
  getColumns: (table: string) => Promise<Array<{ label: string; apply?: string }>>,
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
    const columnResults = await Promise.allSettled(fromTables.map(getColumns));
    const columnCompletions: Completion[] = columnResults
      .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      .map((col) => ({
        label: col.label,
        apply: col.apply,
        type: 'property',
        boost: 10,
      }));

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
  getColumns: (table: string) => Promise<Array<{ label: string; apply?: string }>>,
  fnCompletions: Completion[]
) {
  return [
    sql({ dialect: MySQL }),
    autocompletion({ override: [makeCompletionSource(tables, getColumns, fnCompletions)], defaultKeymap: true }),
  ];
}

export function SQLEditorV2({ query, onChange, onBlur, language, toolboxProps, width, height }: SQLEditorV2Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useLatest(onChange);
  const onBlurRef = useLatest(onBlur);
  const languageRef = useLatest(language);
  const toolboxPropsRef = useLatest(toolboxProps);
  const panelRootRef = useRef<Root | null>(null);

  // Mount the editor once
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const sqlCompartment = new Compartment();

    // Panel factory for the QueryToolbox toolbar
    const makeToolboxPanel = (): Panel => {
      const dom = document.createElement('div');
      const root = createRoot(dom);
      panelRootRef.current = root;

      const renderToolbox = (formatQuery: () => void) => {
        const props = toolboxPropsRef.current;
        if (props) {
          root.render(<QueryToolbox query={props.query} onFormatCode={formatQuery} />);
        }
      };

      // formatQuery is defined below; we'll assign it before the panel renders
      const formatQueryFn = async () => {
        const view = viewRef.current;
        const lang = languageRef.current;
        if (!lang?.formatter || !view) {
          return;
        }
        const formatted = await lang.formatter(view.state.doc.toString());
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
        onChangeRef.current?.(formatted, true);
      };

      renderToolbox(formatQueryFn);

      return { dom, top: false };
    };

    const extensions = [
      lineNumbers(),
      // Start with no tables; reconfigured async once tables are fetched
      sqlCompartment.of(buildSqlExtension([], () => Promise.resolve([]), [])),
      theme.isDark ? oneDarkTheme : [],
      syntaxHighlighting(theme.isDark ? oneDarkHighlightStyle : defaultHighlightStyle),
      showPanel.of(toolboxProps ? makeToolboxPanel : null),
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
        '.cm-editor': {},
        '.cm-gutters': {
          borderRight: `1px solid ${theme.colors.border.weak}`,
        },
        '&.cm-editor .cm-panels.cm-panels-bottom': {
          borderTop: `1px solid ${theme.colors.border.weak}`,
        },
      }),
    ];

    const state = EditorState.create({ doc: query, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Async: fetch tables then reconfigure completion with real data
    let cancelled = false;
    const provider = languageRef.current?.completionProvider;
    if (provider) {
      provider.getTables().then((tables) => {
        if (cancelled) {
          return;
        }
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
      cancelled = true;
      panelRootRef.current?.unmount();
      panelRootRef.current = null;
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

  // Keep toolbox re-rendered when query changes (for copy button etc.)
  useEffect(() => {
    const root = panelRootRef.current;
    const props = toolboxProps;
    if (!root || !props) {
      return;
    }
    const formatQueryFn = async () => {
      const view = viewRef.current;
      const lang = languageRef.current;
      if (!lang?.formatter || !view) {
        return;
      }
      const formatted = await lang.formatter(view.state.doc.toString());
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
      onChangeRef.current?.(formatted, true);
    };
    root.render(<QueryToolbox query={props.query} onFormatCode={formatQueryFn} />);
  }, [toolboxProps, languageRef, onChangeRef]);

  return (
    <div className={styles.container} style={{ width, height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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

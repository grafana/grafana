import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { keywordCompletionSource, MySQL, sql } from '@codemirror/lang-sql';
import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, Extension, Text } from '@codemirror/state';
import { EditorView, lineNumbers, Panel, showPanel, ViewUpdate } from '@codemirror/view';
import { css } from '@emotion/css';
import { tags as t } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useLatest } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { SqlExpressionQuery } from '../../types';
import { QueryToolbox } from '../QueryToolbox';

// Hoisted — MySQL keywords and dialect don't change
const kwSource = keywordCompletionSource(MySQL, true);

function buildGrafanaDarkTheme(theme: GrafanaTheme2): Extension {
  const editorTheme = EditorView.theme(
    {
      '&': {
        backgroundColor: theme.colors.background.primary,
        color: theme.colors.text.primary,
      },
      '.cm-content': {
        caretColor: theme.colors.text.primary,
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: theme.colors.text.primary,
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        {
          backgroundColor: theme.colors.primary.transparent,
        },
      '.cm-activeLine': {
        backgroundColor: theme.colors.action.hover,
      },
      '.cm-gutters': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.secondary,
        borderRight: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: theme.colors.action.hover,
      },
      '.cm-tooltip': {
        backgroundColor: theme.colors.background.secondary,
        border: `1px solid ${theme.colors.border.weak}`,
      },
      '.cm-tooltip .cm-tooltip-arrow:before': {
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
    },
    { dark: true }
  );

  const highlightStyle = HighlightStyle.define([
    { tag: t.keyword, color: '#ff7b72' },
    { tag: [t.name, t.deleted, t.character, t.macroName], color: theme.colors.text.primary },
    { tag: [t.function(t.variableName), t.labelName], color: '#d2a8ff' },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#79c0ff' },
    { tag: [t.definition(t.name), t.separator], color: theme.colors.text.primary },
    { tag: [t.typeName, t.className, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#ffa657' },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.special(t.string)], color: '#79c0ff' },
    { tag: [t.meta, t.comment], color: theme.colors.text.disabled, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: '#79c0ff', textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: '#ff7b72' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#79c0ff' },
    { tag: [t.processingInstruction, t.string, t.inserted], color: '#a5d6ff' },
    { tag: t.invalid, color: theme.colors.error.text },
    { tag: t.number, color: '#79c0ff' },
  ]);

  return [editorTheme, syntaxHighlighting(highlightStyle)];
}

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
  const themeCompartmentRef = useRef(new Compartment());

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
      themeCompartmentRef.current.of(
        theme.isDark ? buildGrafanaDarkTheme(theme) : syntaxHighlighting(defaultHighlightStyle)
      ),
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

  // Reconfigure editor theme when Grafana theme changes (e.g. dark/light toggle)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        theme.isDark ? buildGrafanaDarkTheme(theme) : syntaxHighlighting(defaultHighlightStyle)
      ),
    });
  }, [theme]);

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

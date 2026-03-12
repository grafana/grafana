import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
  currentCompletions,
  selectedCompletion,
  completionStatus,
  acceptCompletion,
} from '@codemirror/autocomplete';
import { keywordCompletionSource, MySQL, sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { Compartment, EditorState, Text } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  Panel,
  showPanel,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
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

// ---------------------------------------------------------------------------
// Inline ghost-text completion (Shopify-style)
// Shows the remaining text of the top completion as faded text after the cursor.
// Press Tab to accept. Computed purely from the autocomplete state — no dispatch needed.
// ---------------------------------------------------------------------------

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-ghost-text';
    span.textContent = this.text;
    return span;
  }
  eq(other: GhostWidget) {
    return this.text === other.text;
  }
}

function getGhostText(state: EditorState): { text: string; pos: number } | null {
  if (completionStatus(state) !== 'active') {
    return null;
  }
  const selected = selectedCompletion(state);
  const all = currentCompletions(state);
  const completion = selected ?? all[0];
  if (!completion) {
    return null;
  }

  const cursor = state.selection.main.head;
  const textBefore = state.doc.sliceString(Math.max(0, cursor - completion.label.length), cursor);

  // Find how much of the label the user has already typed
  let overlap = 0;
  for (let i = Math.min(textBefore.length, completion.label.length); i > 0; i--) {
    if (completion.label.slice(0, i).toLowerCase() === textBefore.slice(textBefore.length - i).toLowerCase()) {
      overlap = i;
      break;
    }
  }

  const remaining = completion.label.slice(overlap);
  if (remaining.length === 0) {
    return null;
  }
  return { text: remaining, pos: cursor };
}

// Use a ViewPlugin that provides decorations — reads completion state each update
const ghostPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    update(update: ViewUpdate) {
      const ghost = getGhostText(update.state);
      if (ghost) {
        this.decorations = Decoration.set([
          Decoration.widget({ widget: new GhostWidget(ghost.text), side: 1 }).range(ghost.pos),
        ]);
      } else {
        this.decorations = Decoration.none;
      }
    }
  },
  { decorations: (v) => v.decorations }
);

function acceptGhostCompletion(view: EditorView): boolean {
  if (completionStatus(view.state) === 'active') {
    return acceptCompletion(view);
  }
  return false;
}

function inlineGhostExtension(): import('@codemirror/state').Extension {
  return [
    ghostPlugin,
    keymap.of([{ key: 'Tab', run: acceptGhostCompletion }]),
    EditorView.theme({
      '.cm-ghost-text': {
        opacity: '0',
        color: '#7c8496',
        pointerEvents: 'none',
        animation: 'ghostFadeIn 0.15s ease-out forwards',
      },
      '@keyframes ghostFadeIn': {
        from: { opacity: '0', transform: 'translateX(-2px)' },
        to: { opacity: '0.45', transform: 'translateX(0)' },
      },
    }),
  ];
}

function buildSqlExtension(
  tables: string[],
  getColumns: (table: string) => Promise<Array<{ label: string; apply?: string }>>,
  fnCompletions: Completion[]
) {
  return [
    sql({ dialect: MySQL }),
    autocompletion({
      override: [makeCompletionSource(tables, getColumns, fnCompletions)],
      defaultKeymap: true,
      activateOnTyping: true,
      activateOnCompletion: () => true,
    }),
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
      highlightActiveLine(),
      // Start with no tables; reconfigured async once tables are fetched
      sqlCompartment.of(buildSqlExtension([], () => Promise.resolve([]), [])),
      inlineGhostExtension(),
      oneDark,
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

        // Active line glow
        '.cm-activeLine': {
          background: `linear-gradient(90deg, color-mix(in srgb, ${theme.colors.primary.main} 8%, transparent) 0%, transparent 80%)`,
        },
        '.cm-activeLineGutter': {
          background: `color-mix(in srgb, ${theme.colors.primary.main} 8%, transparent)`,
          color: theme.colors.text.primary,
        },

        // Glassmorphism dropdown with animated entrance
        '.cm-tooltip.cm-tooltip-autocomplete': {
          background: `color-mix(in srgb, ${theme.colors.background.elevated} 85%, transparent)`,
          backdropFilter: 'blur(12px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
          border: `1px solid color-mix(in srgb, ${theme.colors.border.weak} 60%, transparent)`,
          borderRadius: '10px',
          boxShadow: `0 8px 32px rgba(0,0,0,0.28), inset 0 0.5px 0 rgba(255,255,255,0.06)`,
          padding: '4px',
          animation: 'dropIn 0.12s ease-out',
        },
        '@keyframes dropIn': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        '.cm-tooltip-autocomplete > ul': {
          fontFamily: theme.typography.fontFamilyMonospace,
          fontSize: '12px',
          maxHeight: '180px',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        },
        '.cm-tooltip-autocomplete > ul::-webkit-scrollbar': {
          display: 'none',
        },
        '.cm-tooltip-autocomplete > ul > li': {
          padding: '4px 8px',
          borderRadius: '6px',
          lineHeight: '1.6',
          margin: '1px 0',
          transition: 'background 0.1s ease',
          position: 'relative',
        },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
          background: `color-mix(in srgb, ${theme.colors.primary.main} 15%, transparent)`,
        },
        // "tab" hint on the selected item
        '.cm-tooltip-autocomplete > ul > li[aria-selected]::after': {
          content: '"Tab"',
          position: 'absolute',
          right: '6px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '9px',
          fontFamily: theme.typography.fontFamily,
          color: theme.colors.text.disabled,
          background: theme.colors.action.hover,
          padding: '1px 5px',
          borderRadius: '4px',
          letterSpacing: '0.3px',
          lineHeight: '1.4',
        },
        '.cm-completionIcon': {
          display: 'none',
        },
        '.cm-completionMatchedText': {
          textDecoration: 'none',
          fontWeight: 700,
          color: theme.colors.text.maxContrast,
        },
        '.cm-completionDetail': {
          display: 'none',
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

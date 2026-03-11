import { autocompletion, completeFromList, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { MySQL, sql, SQLNamespace } from '@codemirror/lang-sql';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { oneDarkHighlightStyle, oneDarkTheme } from '@codemirror/theme-one-dark';
import { EditorView, ViewUpdate } from '@codemirror/view';
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

async function buildCompletionSource(
  provider: SQLEditorV2CompletionProvider,
  context: CompletionContext
): Promise<CompletionResult | null> {
  const tables = await provider.getTables();

  // Build a SQLNamespace: { tableName: [col1, col2, ...] }
  const schema: SQLNamespace = {};
  for (const table of tables) {
    const columns = await provider.getColumns(table);
    schema[table] = columns;
  }

  // Delegate to lang-sql's built-in schema completion
  const { schemaCompletionSource } = await import('@codemirror/lang-sql');
  const schemaSource = schemaCompletionSource({ schema, dialect: MySQL });
  const schemaResult = schemaSource(context);

  const functions = provider.getFunctions?.() ?? [];
  if (functions.length === 0) {
    return schemaResult instanceof Promise ? await schemaResult : schemaResult;
  }

  // Merge function completions
  const fnSource = completeFromList(functions.map((f) => ({ label: f, type: 'function' })));
  const fnRaw = fnSource(context);

  const [resolvedSchema, fnResult] = await Promise.all([
    schemaResult instanceof Promise ? schemaResult : Promise.resolve(schemaResult),
    fnRaw instanceof Promise ? fnRaw : Promise.resolve(fnRaw),
  ]);

  if (!resolvedSchema && !fnResult) {
    return null;
  }
  if (!resolvedSchema) {
    return fnResult;
  }
  if (!fnResult) {
    return resolvedSchema;
  }

  return {
    from: resolvedSchema.from,
    options: [...resolvedSchema.options, ...fnResult.options],
  };
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

    const completionSource = languageRef.current?.completionProvider
      ? (context: CompletionContext) => buildCompletionSource(languageRef.current!.completionProvider!, context)
      : null;

    const extensions = [
      sql({ dialect: MySQL, upperCaseKeywords: true }),
      theme.isDark ? oneDarkTheme : [],
      syntaxHighlighting(theme.isDark ? oneDarkHighlightStyle : defaultHighlightStyle),
      autocompletion({ override: completionSource ? [completionSource] : undefined }),
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
    <div className={styles.container} style={{ width, height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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

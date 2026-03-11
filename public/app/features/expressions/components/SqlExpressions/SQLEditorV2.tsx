import { MySQL, sql } from '@codemirror/lang-sql';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

export interface SQLEditorV2LanguageDefinition {
  id: string;
  // Placeholder for future CM6 completion extension — ignored in POC
  completionProvider?: unknown;
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

export function SQLEditorV2({ query, onChange, onBlur, language, children, width, height }: SQLEditorV2Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useLatest(onChange);
  const onBlurRef = useLatest(onBlur);

  // Mount the editor once
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const extensions = [
      sql({ dialect: MySQL }),
      theme.isDark ? oneDark : syntaxHighlighting(defaultHighlightStyle),
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

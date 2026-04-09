/**
 * Proof-of-concept wrapper around `@uiw/react-codemirror` (CodeMirror 6) for migration
 * exploration (DPRO-1). Import from `@grafana/ui/internal` only; not a supported public API.
 */
import { sql } from '@codemirror/lang-sql';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

export interface UiwCodeMirrorPocProps {
  value: string;
  onChange?: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  className?: string;
}

function grafanaLightCodeMirrorTheme(theme: GrafanaTheme2): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: theme.colors.background.primary,
        color: theme.colors.text.primary,
      },
      '.cm-scroller': {
        fontFamily: theme.typography.fontFamilyMonospace,
      },
      '.cm-content': { caretColor: theme.colors.text.primary },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: theme.colors.text.primary },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: theme.colors.action.focus,
      },
      '.cm-activeLine': { backgroundColor: theme.colors.action.hover },
      '.cm-gutters': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.secondary,
        border: 'none',
      },
      '.cm-activeLineGutter': { backgroundColor: theme.colors.action.hover },
    },
    { dark: false }
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'uiw-codemirror-poc',
    width: '100%',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
});

/**
 * Minimal SQL-highlighted editor using `@uiw/react-codemirror`, styled to roughly match
 * Grafana light/dark surfaces. For side-by-side comparison with Monaco-based `CodeEditor`.
 */
export function UiwCodeMirrorPoc({ value, onChange, height = '200px', readOnly, className }: UiwCodeMirrorPocProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const extensions = useMemo(() => {
    const ext: Extension[] = [sql(), EditorView.lineWrapping];
    if (!theme.isDark) {
      ext.push(grafanaLightCodeMirrorTheme(theme));
    }
    return ext;
  }, [theme]);

  return (
    <div className={cx(styles.wrapper, className)}>
      <CodeMirror
        value={value}
        height={height}
        theme={theme.isDark ? 'dark' : 'none'}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        editable={readOnly !== true}
        basicSetup={{ lineNumbers: false, foldGutter: false }}
      />
    </div>
  );
}

import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, CodeMirrorEditor } from '@grafana/ui';

import { type CodeLanguage } from '../panelcfg.gen';

import { getCodeMirrorLanguage, TRANSPARENT_EDITOR_THEME } from './utils';

export interface TextNGCodeViewProps {
  content: string;
  language?: CodeLanguage;
  showLineNumbers: boolean;
  /** CSS height passed straight to CodeMirror. Defaults to filling the parent. */
  height?: string;
  transparent?: boolean;
}

/**
 * Read-only, syntax-highlighted rendering of code-mode content
 */
export function TextNGCodeView({
  content,
  language,
  showLineNumbers,
  height = '100%',
  transparent,
}: TextNGCodeViewProps) {
  const styles = useStyles2(getStyles, transparent);

  const basicSetup = useMemo(
    () => ({
      lineNumbers: showLineNumbers,
      foldGutter: false,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
      bracketMatching: false,
      closeBrackets: false,
      autocompletion: false,
      highlightSelectionMatches: false,
      history: false,
      indentOnInput: false,
      allowMultipleSelections: false,
      rectangularSelection: false,
      crosshairCursor: false,
      dropCursor: false,
    }),
    [showLineNumbers]
  );

  return (
    <CodeMirrorEditor
      value={content}
      onChange={() => {}}
      language={getCodeMirrorLanguage(language)}
      readOnly
      lineWrapping
      basicSetup={basicSetup}
      height={height}
      aria-label={t('textng.code-view.aria-label-code-content', 'Code content')}
      loadingFallback={<pre className={styles.loadingFallback}>{content}</pre>}
      theme={transparent ? TRANSPARENT_EDITOR_THEME : undefined}
    />
  );
}

const getStyles = (theme: GrafanaTheme2, transparent?: boolean) => ({
  // Mirrors the CodeMirror theme
  loadingFallback: css({
    margin: 0,
    padding: '4px 2px 4px 6px',
    height: '100%',
    overflow: 'auto',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.code.fontSize,
    lineHeight: theme.typography.code.lineHeight,
    color: theme.components.input.text,
    backgroundColor: transparent ? 'transparent' : theme.components.input.background,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});

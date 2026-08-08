import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

import { type CodeLanguage } from '../panelcfg.gen';

import { transparentCodeMirror } from './editor/editorLayout';
import { getCodeMirrorLanguage } from './utils';

export interface TextNGCodeViewProps {
  content: string;
  language?: CodeLanguage;
  showLineNumbers: boolean;
  transparent?: boolean;
}

/**
 * Read-only, syntax-highlighted rendering of code-mode content
 */
export function TextNGCodeView({ content, language, showLineNumbers, transparent }: TextNGCodeViewProps) {
  const styles = useStyles2(getStyles);

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
    <div className={cx(styles.container, transparent && transparentCodeMirror)}>
      <CodeMirrorEditor
        value={content}
        onChange={() => {}}
        language={getCodeMirrorLanguage(language)}
        readOnly
        lineWrapping
        basicSetup={basicSetup}
        height="100%"
        aria-label={t('textng.code-view.aria-label-code-content', 'Code content')}
        loadingFallback={
          <pre className={cx(styles.loadingFallback, transparent && styles.transparentFallback)}>{content}</pre>
        }
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
  }),
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
    backgroundColor: theme.components.input.background,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  transparentFallback: css({
    backgroundColor: 'transparent',
  }),
});

import { useMemo, type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2, CodeMirrorEditor } from '@grafana/ui';
import { createCodeEditorTheme } from '@grafana/ui/codemirror';

import { type TextNGCodeViewProps } from './TextNGCodeView';
import { getCodeMirrorLanguage } from './utils';

/**
 * Read-only, syntax-highlighted rendering of code-mode content
 */
export function TextNGCodeViewImplementation({
  content,
  language,
  showLineNumbers,
  height = '100%',
  transparent,
  loadingFallback,
}: TextNGCodeViewProps & { loadingFallback: ReactNode }) {
  const theme = useTheme2();
  const editorTheme = useMemo(
    () => (transparent ? createCodeEditorTheme(theme, { transparent: true }) : undefined),
    [theme, transparent]
  );

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
      loadingFallback={loadingFallback}
      theme={editorTheme}
    />
  );
}

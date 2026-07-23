import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

import { type CodeLanguage } from '../../schemas/textng/panelcfg.gen';

import { getCodeMirrorLanguage } from './codeLanguages';

export interface TextNGCodeViewProps {
  content: string;
  language?: CodeLanguage;
  showLineNumbers: boolean;
}

/**
 * Read-only, syntax-highlighted rendering of code-mode content
 */
export function TextNGCodeView({ content, language, showLineNumbers }: TextNGCodeViewProps) {
  const basicSetup = useMemo(
    () => ({
      lineNumbers: showLineNumbers,
      foldGutter: false,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
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
      height="100%"
      aria-label={t('textng.code-view.aria-label-code-content', 'Code content')}
    />
  );
}

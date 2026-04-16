import { loadLanguage, type LanguageName } from '@uiw/codemirror-extensions-langs';
import CodeMirror from '@uiw/react-codemirror';
import { memo, useMemo, type ComponentProps } from 'react';

type CodeMirrorExtensions = NonNullable<ComponentProps<typeof CodeMirror>['extensions']>;
type CodeEditorLanguage = LanguageName;

export interface CodeEditorProps {
  value: string;
  language?: CodeEditorLanguage;
  height?: string;
  onChange: (value: string) => void;
}

const getLanguageExtensions = (language?: CodeEditorLanguage): CodeMirrorExtensions => {
  if (!language) {
    return [];
  }

  const extension = loadLanguage(language);
  return extension ? [extension] : [];
};

export const CodeEditor = memo(function CodeEditor({ value, language, height = '200px', onChange }: CodeEditorProps) {
  const extensions = useMemo(() => getLanguageExtensions(language), [language]);

  return (
    <CodeMirror value={value} height={height} extensions={extensions} onChange={(nextValue) => onChange(nextValue)} />
  );
});

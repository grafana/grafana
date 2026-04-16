import { loadLanguage, type LanguageName } from '@uiw/codemirror-extensions-langs';
import { basicDark } from '@uiw/codemirror-theme-basic';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { memo, useMemo } from 'react';

type CodeMirrorExtensions = Extension[];
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
    <CodeMirror
      theme={basicDark}
      value={value}
      height={height}
      extensions={extensions}
      onChange={(nextValue) => onChange(nextValue)}
    />
  );
});

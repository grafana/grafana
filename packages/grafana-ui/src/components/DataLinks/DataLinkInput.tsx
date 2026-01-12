import { memo, useMemo } from 'react';

import { VariableSuggestion } from '@grafana/data';

import { CodeMirrorEditor } from '../CodeMirror/CodeMirrorEditor';

import { createDataLinkAutocompletion, createDataLinkHighlighter, createDataLinkTheme } from './codemirrorUtils';

interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
}

export const DataLinkInput = memo(
  ({
    value,
    onChange,
    suggestions,
    placeholder = 'http://your-grafana.com/d/000000010/annotations',
  }: DataLinkInputProps) => {
    // Memoize autocompletion extension to avoid recreating on every render
    const autocompletionExtension = useMemo(() => createDataLinkAutocompletion(suggestions), [suggestions]);

    return (
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        themeFactory={createDataLinkTheme}
        highlighterFactory={createDataLinkHighlighter}
        autocompletion={autocompletionExtension}
        ariaLabel={placeholder}
        closeBrackets={false}
      />
    );
  }
);

DataLinkInput.displayName = 'DataLinkInput';

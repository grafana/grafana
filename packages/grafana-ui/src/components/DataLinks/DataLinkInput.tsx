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

// This is memoized because rerendering the editor can grab focus in certain
// usage contexts. Same memo contract as the previous Slate-based version.
export const DataLinkInput = memo(
  ({
    value,
    onChange,
    suggestions,
    placeholder = 'http://your-grafana.com/d/000000010/annotations',
  }: DataLinkInputProps) => {
    // Rebuild autocompletion extension only when the suggestions array changes.
    // themeFactory and highlighterFactory are stable module-level references
    // so they never trigger unnecessary Compartment reconfiguration.
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
        lineWrapping={true}
      />
    );
  }
);

DataLinkInput.displayName = 'DataLinkInput';

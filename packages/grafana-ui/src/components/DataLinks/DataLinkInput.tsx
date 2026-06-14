import { memo, useMemo } from 'react';

import { type VariableSuggestion } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { CodeMirrorInlineInput } from '../CodeMirror/InlineInput';

import { createDataLinkHighlighter, createDataLinkTheme, dataLinkAutocompletion } from './codemirrorUtils';

interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
  // For accessibility, this should be the id of the label that describes this input.
  // This is needed because the input is rendered as a contenteditable element and can't use the normal label/htmlFor logic.
  ['aria-labelledby']?: string;
}

export const DataLinkInput = memo(
  ({
    value,
    onChange,
    suggestions,
    placeholder = 'http://your-grafana.com/d/000000010/annotations',
    ['aria-labelledby']: ariaLabelledby,
  }: DataLinkInputProps) => {
    const theme = useTheme2();

    // The highlighter tags `${...}` tokens; the theme colors them. Stable across
    // renders unless the Grafana theme changes.
    const extensions = useMemo(() => [createDataLinkHighlighter(), createDataLinkTheme(theme)], [theme]);
    const completionSources = useMemo(() => [dataLinkAutocompletion(suggestions)], [suggestions]);

    return (
      <CodeMirrorInlineInput
        id="data-link-input"
        value={value}
        // onChange's optional second arg is unused here; the signatures are compatible.
        onChange={onChange}
        placeholder={placeholder}
        aria-labelledby={ariaLabelledby}
        completionSources={completionSources}
        extensions={extensions}
      />
    );
  }
);

DataLinkInput.displayName = 'DataLinkInput';

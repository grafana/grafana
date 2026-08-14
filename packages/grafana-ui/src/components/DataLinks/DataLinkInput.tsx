import { memo, useMemo } from 'react';

import { type VariableSuggestion } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { CodeMirrorInlineInput } from '../CodeMirror/InlineInput';

import {
  createDataLinkHighlighter,
  createDataLinkTheme,
  dataLinkAutocompletion,
  type DataLinkInterpolationMode,
} from './codemirrorUtils';

interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
  // For accessibility, this should be the id of the label that describes this input.
  // This is needed because the input is rendered as a contenteditable element and can't use the normal label/htmlFor logic.
  ['aria-labelledby']?: string;
  // DOM id applied to the input wrapper. Defaults to the URL field's historical
  // id; pass a distinct id when more than one DataLinkInput renders together
  // (e.g. a title alongside a URL) to keep ids unique.
  id?: string;
  // Selects the completion semantics: 'url' (default) treats `=` as a query-param
  // trigger and encodes template vars as `${var:queryparam}`; 'text' triggers on
  // `$` only and applies plain `${var}`, matching how non-URL fields interpolate.
  interpolationMode?: DataLinkInterpolationMode;
  // Forwarded to the inline input; `false` renders the proportional UI font.
  monospace?: boolean;
}

export const DataLinkInput = memo(
  ({
    value,
    onChange,
    suggestions,
    placeholder = 'http://your-grafana.com/d/000000010/annotations',
    ['aria-labelledby']: ariaLabelledby,
    id = 'data-link-input',
    interpolationMode = 'url',
    monospace = true,
  }: DataLinkInputProps) => {
    const theme = useTheme2();

    // The highlighter tags `${...}` tokens; the theme colors them. Stable across
    // renders unless the Grafana theme changes.
    const extensions = useMemo(() => [createDataLinkHighlighter(), createDataLinkTheme(theme)], [theme]);
    const completionSources = useMemo(
      () => [dataLinkAutocompletion(suggestions, { mode: interpolationMode })],
      [suggestions, interpolationMode]
    );

    return (
      <CodeMirrorInlineInput
        id={id}
        value={value}
        // CodeMirrorInlineInput only ever calls onChange(value); the optional
        // callback in DataLinkInput's onChange is never invoked, so passing it
        // straight through is safe.
        onChange={onChange}
        placeholder={placeholder}
        monospace={monospace}
        aria-labelledby={ariaLabelledby}
        completionSources={completionSources}
        extensions={extensions}
      />
    );
  }
);

DataLinkInput.displayName = 'DataLinkInput';

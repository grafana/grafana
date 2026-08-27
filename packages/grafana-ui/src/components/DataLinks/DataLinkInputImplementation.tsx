import { memo, useMemo } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { CodeMirrorInlineInput } from '../CodeMirror/InlineInput';

import { type DataLinkInputProps } from './DataLinkInput';
import { createDataLinkHighlighter, createDataLinkTheme, dataLinkAutocompletion } from './codemirrorUtils';

export const DataLinkInputImplementation = memo(
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

DataLinkInputImplementation.displayName = 'DataLinkInputImplementation';

import CodeMirror from '@uiw/react-codemirror';
import { memo } from 'react';

import { type CodeMirrorEditorProps, type CodeMirrorEditorSetupProps } from './types';
import { isThemeOverrides, useCodeMirrorSetup } from './useCodeMirrorSetup';

type PublicSetupProps = Omit<CodeMirrorEditorProps, 'loadingFallback'>;

/** Requires every key to be listed, so a public prop can't be skipped when copying. */
type EveryProp<T> = { [K in keyof Required<T>]: T[K] };

/**
 * Copies the public props one by one. Plugins bundle their own copy of
 * CodeMirror, and extensions built with it crash or are ignored in Grafana's
 * editor, so nothing outside this list reaches CodeMirror, even when a caller
 * passes it with a type cast or from plain JavaScript. `theme` is kept only
 * when it is plain style overrides.
 */
function toSetupProps(props: CodeMirrorEditorProps): EveryProp<PublicSetupProps> {
  return {
    value: props.value,
    language: props.language,
    sqlDialect: props.sqlDialect,
    height: props.height,
    onChange: props.onChange,
    onBlur: props.onBlur,
    onSave: props.onSave,
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    completionSources: props.completionSources,
    completionMode: props.completionMode,
    completeOnSpace: props.completeOnSpace,
    variableSuggestions: props.variableSuggestions,
    variableCompletionOptions: props.variableCompletionOptions,
    signatureHelp: props.signatureHelp,
    placeholder: props.placeholder,
    basicSetup: props.basicSetup,
    theme: isThemeOverrides(props.theme) ? props.theme : undefined,
    indentWithTab: props.indentWithTab,
    readOnly: props.readOnly,
    lineWrapping: props.lineWrapping,
  };
}

/** Implementation behind the public `CodeMirrorEditor`. Accepts no raw extensions. */
export const CodeEditor = memo(function CodeEditor(props: CodeMirrorEditorProps) {
  const setupProps: CodeMirrorEditorSetupProps = toSetupProps(props);
  const { ref, props: editorProps, languageAlert } = useCodeMirrorSetup(setupProps);

  return (
    <>
      {languageAlert}
      <CodeMirror ref={ref} {...editorProps} />
    </>
  );
});

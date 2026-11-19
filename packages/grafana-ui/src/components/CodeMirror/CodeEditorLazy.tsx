import { lazy, type ReactNode, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { isThemeOverrides } from './themeOverrides';
import { type BaseCodeEditorProps, type CodeMirrorEditorProps, type InternalCodeMirrorEditorProps } from './types';

const LazyBaseCodeEditor = lazy(() =>
  import(/* webpackChunkName: "react-codemirror-editor" */ './BaseCodeEditor').then((module) => ({
    default: module.BaseCodeEditor,
  }))
);

type PublicBaseProps = Omit<CodeMirrorEditorProps, 'loadingFallback'>;

/** Requires every key to be listed, so a public prop can't be skipped when copying. */
type EveryProp<T> = { [K in keyof Required<T>]: T[K] };

/**
 * Copies only the public props, so a plugin's raw extensions never reach CodeMirror,
 * even through a type cast or plain JavaScript.
 */
function getPublicProps(props: CodeMirrorEditorProps): EveryProp<PublicBaseProps> {
  return {
    value: props.value,
    language: props.language,
    syntaxHighlighting: props.syntaxHighlighting,
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

function LazyEditor({ loadingFallback, ...props }: BaseCodeEditorProps & { loadingFallback?: ReactNode }) {
  return (
    <ErrorBoundaryAlert
      boundaryName="CodeMirrorEditorLazy"
      title={t('grafana-ui.code-mirror.error-label', 'CodeMirror editor failed to load')}
      style="page"
    >
      <Suspense
        fallback={
          loadingFallback ?? (
            <LoadingPlaceholder text={t('grafana-ui.code-mirror.loading-placeholder', 'Loading editor')} />
          )
        }
      >
        <LazyBaseCodeEditor {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  const { completionSources, signatureHelp, ...editorProps } = getPublicProps(props);
  return (
    <LazyEditor
      {...editorProps}
      publicCompletionSources={completionSources}
      publicSignatureHelp={signatureHelp}
      loadingFallback={props.loadingFallback}
    />
  );
}

export function InternalCodeMirrorEditor(props: InternalCodeMirrorEditorProps) {
  return <LazyEditor {...props} />;
}

import { lazy, type ReactNode, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type CodeMirrorEditorProps, type CustomCodeEditorProps } from './types';

const loadEditors = () => import(/* webpackChunkName: "react-codemirror-editor" */ './CodeEditor');
const CodeEditor = lazy(() => loadEditors().then((module) => ({ default: module.CodeEditor })));
const CustomCodeEditorImplementation = lazy(() =>
  loadEditors().then((module) => ({ default: module.CustomCodeEditor }))
);

function LazyEditor({ loadingFallback, children }: { loadingFallback?: ReactNode; children: ReactNode }) {
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
        {children}
      </Suspense>
    </ErrorBoundaryAlert>
  );
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  return (
    <LazyEditor loadingFallback={props.loadingFallback}>
      <CodeEditor {...props} />
    </LazyEditor>
  );
}

/**
 * Grafana's CodeMirror editor plus raw CodeMirror extensions and theme extensions,
 * for core features that need behavior `CodeMirrorEditor` has no prop for. Plugins
 * use `CodeMirrorEditor`, because extensions built with a plugin's own copy of
 * CodeMirror don't work in Grafana's editor.
 */
export function CustomCodeEditor({ loadingFallback, ...props }: CustomCodeEditorProps) {
  return (
    <LazyEditor loadingFallback={loadingFallback}>
      <CustomCodeEditorImplementation {...props} />
    </LazyEditor>
  );
}

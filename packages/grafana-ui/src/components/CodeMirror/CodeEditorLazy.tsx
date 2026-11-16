import { lazy, type ReactNode, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type CodeMirrorEditorProps, type CustomCodeEditorProps } from './types';

const loadEditors = () => import(/* webpackChunkName: "react-codemirror-editor" */ './CodeEditor');

const LazyCodeEditor = lazy(() => loadEditors().then((module) => ({ default: module.CodeEditor })));

const LazyCustomCodeEditor = lazy(() => loadEditors().then((module) => ({ default: module.CustomCodeEditor })));

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
      <LazyCodeEditor {...props} />
    </LazyEditor>
  );
}

export function CustomCodeEditor({ loadingFallback, ...props }: CustomCodeEditorProps) {
  return (
    <LazyEditor loadingFallback={loadingFallback}>
      <LazyCustomCodeEditor {...props} />
    </LazyEditor>
  );
}

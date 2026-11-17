import { lazy, type ReactNode, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import {
  type BaseCodeMirrorEditorProps,
  type CodeMirrorEditorProps,
  type InternalCodeMirrorEditorProps,
} from './types';

const LazyBaseCodeMirrorEditor = lazy(() =>
  import(/* webpackChunkName: "react-codemirror-editor" */ './BaseCodeMirrorEditor').then((module) => ({
    default: module.BaseCodeMirrorEditor,
  }))
);

function LazyEditor({ loadingFallback, ...props }: BaseCodeMirrorEditorProps & { loadingFallback?: ReactNode }) {
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
        <LazyBaseCodeMirrorEditor {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  return <LazyEditor {...props} />;
}

export function InternalCodeMirrorEditor(props: InternalCodeMirrorEditorProps) {
  return <LazyEditor {...props} />;
}

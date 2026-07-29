import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type CodeMirrorEditorProps } from './types';

const CodeEditor = lazy(() =>
  import(/* webpackChunkName: "react-codemirror-editor" */ './CodeEditor').then((module) => ({
    default: module.CodeEditor,
  }))
);

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  return (
    <ErrorBoundaryAlert
      boundaryName="CodeMirrorEditorLazy"
      title={t('grafana-ui.code-mirror.error-label', 'CodeMirror editor failed to load')}
      style="page"
    >
      <Suspense
        fallback={<LoadingPlaceholder text={t('grafana-ui.code-mirror.loading-placeholder', 'Loading editor')} />}
      >
        <CodeEditor {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}

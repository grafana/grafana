import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { type DiffViewerProps } from '../DiffViewer/types';
import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

const DiffEditor = lazy(() =>
  import(/* webpackChunkName: "react-codemirror-diff-editor" */ './DiffEditor').then((module) => ({
    default: module.DiffEditor,
  }))
);

/** @internal */
export function CodeMirrorDiffEditor(props: DiffViewerProps) {
  return (
    <ErrorBoundaryAlert
      boundaryName="CodeMirrorDiffEditorLazy"
      title={t('grafana-ui.code-mirror.error-label', 'CodeMirror editor failed to load')}
      style="page"
    >
      <Suspense
        fallback={<LoadingPlaceholder text={t('grafana-ui.code-mirror.loading-placeholder', 'Loading editor')} />}
      >
        <DiffEditor {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}

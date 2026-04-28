import { lazy, Suspense } from 'react';
import { type ReactDiffViewerProps } from 'react-diff-viewer-continued';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

const LazyDiffViewerInternal = lazy(() => import('./DiffViewer').then((module) => ({ default: module.DiffViewer })));

const LazyDiffViewer = (props: ReactDiffViewerProps) => (
  <Suspense fallback={<LoadingPlaceholder text={t('diff-viewer.loading', 'Loading diff...')} />}>
    <LazyDiffViewerInternal {...props} />
  </Suspense>
);

export default LazyDiffViewer;

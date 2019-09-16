import React, { lazy, Suspense, FunctionComponent } from 'react';
import { cx } from 'emotion';
import { ErrorBoundaryAlert, LoadingPlaceholder } from '@grafana/ui';

export const LoadingChunkPlaceHolder: FunctionComponent = () => (
  <div className={cx('preloader')}>
    <LoadingPlaceholder text={'Loading chunk...'} />
  </div>
);

export const SafeDynamicImport = (importStatement: Promise<any>) => ({ ...props }) => {
  const LazyComponent = lazy(() => importStatement);
  return (
    <ErrorBoundaryAlert style={'page'} title={"We did't manage to load a chunk, try refreshing the page."}>
      <Suspense fallback={<LoadingChunkPlaceHolder />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
};

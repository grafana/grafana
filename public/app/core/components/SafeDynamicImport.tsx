import React, { lazy, Suspense, FunctionComponent } from 'react';
import { cx, css } from 'emotion';
import { LoadingPlaceholder, ErrorBoundary, Button } from '@grafana/ui';

export const LoadingChunkPlaceHolder: FunctionComponent = () => (
  <div className={cx('preloader')}>
    <LoadingPlaceholder text={'Loading...'} />
  </div>
);

function getAlertPageStyle() {
  return css`
    width: 500px;
    margin: 64px auto;
  `;
}

export const SafeDynamicImport = (importStatement: Promise<any>) => ({ ...props }) => {
  const LazyComponent = lazy(() => importStatement);
  return (
    <ErrorBoundary>
      {({ error, errorInfo }) => {
        if (!errorInfo) {
          return (
            <Suspense fallback={<LoadingChunkPlaceHolder />}>
              <LazyComponent {...props} />
            </Suspense>
          );
        }

        return (
          <div className={getAlertPageStyle()}>
            <h2>Grafana has been updated. Please refresh your browser.</h2>
            <br />
            <Button size={'lg'} variant={'secondary'} icon="fa fa-repeat" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {error && error.toString()}
              <br />
              {errorInfo.componentStack}
            </details>
          </div>
        );
      }}
    </ErrorBoundary>
  );
};

import React, { lazy, Suspense } from 'react';
import { css } from 'emotion';
import { ErrorBoundary } from '@grafana/ui';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';
import { ShowLoadingChunkError } from './ShowLoadingChunkError';
import { ShowErrorWithStack } from '@grafana/ui/src/components/ErrorBoundary/ShowErrorWithStack';

function getAlertPageStyle(): string {
  return css`
    width: 508px;
    margin: 128px auto;
  `;
}

export const GRAFANA_CHUNK_LOAD_ERROR = 'GRAFANA_CHUNK_LOAD_ERROR';

export const isChunkError = (error: Error): boolean => {
  if (error && error.message && error.message.indexOf(GRAFANA_CHUNK_LOAD_ERROR) !== -1) {
    return true;
  }

  return false;
};

export const SafeDynamicImport = (importStatement: Promise<any>) => ({ ...props }) => {
  const LazyComponent = lazy(() =>
    importStatement.catch(error => {
      throw new Error(`${GRAFANA_CHUNK_LOAD_ERROR}:${error.message}`);
    })
  );

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

        if (isChunkError(error)) {
          return <ShowLoadingChunkError error={error} errorInfo={errorInfo} className={getAlertPageStyle()} />;
        }

        return (
          <ShowErrorWithStack
            className={getAlertPageStyle()}
            error={error}
            errorInfo={errorInfo}
            title="An unexpected error happened"
          />
        );
      }}
    </ErrorBoundary>
  );
};

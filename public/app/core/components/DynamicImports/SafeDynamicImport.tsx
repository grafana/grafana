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

export const isChunkError = (error: Error): boolean => {
  if (error && error.message && error.message.match(/Loading chunk \w+ failed/)) {
    return true;
  }

  return false;
};

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

import React from 'react';
import Loadable from 'react-loadable';
import { css } from 'emotion';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';
import { ErrorLoadingChunk } from './ErrorLoadingChunk';

function getAlertPageStyle(): string {
  return css`
    width: 508px;
    margin: 128px auto;
  `;
}

export const Loading = (props: { error: Error; pastDelay: boolean }) => {
  const { error, pastDelay } = props;

  if (error) {
    return <ErrorLoadingChunk className={getAlertPageStyle()} error={error} />;
  }

  if (pastDelay) {
    return <LoadingChunkPlaceHolder />;
  }

  return null;
};

export const SafeDynamicImport = (importStatement: Promise<any>) => ({ ...props }) => {
  const LoadableComponent = Loadable({
    loader: () => importStatement,
    loading: Loading,
  });

  return <LoadableComponent {...props} />;
};

import React from 'react';
import Loadable from 'react-loadable';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';
import { ErrorLoadingChunk } from './ErrorLoadingChunk';

export const loadComponentHandler = (props: { error: Error; pastDelay: boolean }) => {
  const { error, pastDelay } = props;
  console.log('LoadComHandle');
  if (error) {
    return <ErrorLoadingChunk error={error} />;
  }

  if (pastDelay) {
    return <LoadingChunkPlaceHolder />;
  }

  return null;
};

export const SafeDynamicImport = (importStatement: Promise<any>) => {
  const LoadableComponent = Loadable({
    loader: () => importStatement,
    loading: loadComponentHandler,
  });

  return ({ ...props }) => {
    return <LoadableComponent {...props} />;
  };
};

import React from 'react';
import Loadable from 'react-loadable';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';
import { ErrorLoadingChunk } from './ErrorLoadingChunk';
import { GrafanaRouteComponent } from 'app/core/navigation/types';

export const loadComponentHandler = (props: { error: Error; pastDelay: boolean }) => {
  const { error, pastDelay } = props;

  if (error) {
    return <ErrorLoadingChunk error={error} />;
  }

  if (pastDelay) {
    return <LoadingChunkPlaceHolder />;
  }

  return null;
};

export const SafeDynamicImport = (loader: () => Promise<any>): GrafanaRouteComponent =>
  Loadable({
    loader: loader,
    loading: loadComponentHandler,
  });

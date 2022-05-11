import React from 'react';
import Loadable from 'react-loadable';

import { GrafanaRouteComponent } from 'app/core/navigation/types';

import { ErrorLoadingChunk } from './ErrorLoadingChunk';
import { LoadingChunkPlaceHolder } from './LoadingChunkPlaceHolder';

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

import { lazy } from 'react';

export { hasGeoCell, isGeometry } from './utils';
export { type OpenLayersContextValue, OpenLayersContext, useOpenLayersContext } from './OpenLayersContext';

export const LazyOpenLayersProvider = lazy(() =>
  import('./OpenLayersProvider').then((module) => ({ default: module.OpenLayersProvider }))
);

import { lazy } from 'react';

const LazyDiffViewer = lazy(() => import('./DiffViewer').then((module) => ({ default: module.DiffViewer })));

export default LazyDiffViewer;

import { Suspense, lazy } from 'react';

import type { CentralAlertHistorySceneV1Props } from '@grafana/data/types';

const CentralAlertHistoryScene = lazy(() => import('./CentralAlertHistoryScene'));

const CentralAlertHistorySceneExposedComponent = (props: CentralAlertHistorySceneV1Props) => (
  <Suspense fallback={'Loading...'}>
    <CentralAlertHistoryScene {...props} />
  </Suspense>
);

export default CentralAlertHistorySceneExposedComponent;

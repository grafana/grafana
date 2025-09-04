import { Suspense, lazy } from 'react';

import { CentralAlertHistorySceneProps } from '@grafana/data';

const CentralAlertHistoryScene = lazy(() => import('./CentralAlertHistoryScene'));

const CentralAlertHistorySceneExposedComponent = (props: CentralAlertHistorySceneProps) => (
  <Suspense fallback={'Loading...'}>
    <CentralAlertHistoryScene {...props} />
  </Suspense>
);

export default CentralAlertHistorySceneExposedComponent;

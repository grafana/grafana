import { Suspense, lazy } from 'react';

import { CentralAlertHistorySceneV1Props } from '@grafana/data';

const CentralAlertHistoryScene = lazy(() => import('./CentralAlertHistoryScene'));

const CentralAlertHistorySceneExposedComponent = (props: CentralAlertHistorySceneV1Props) => (
  <Suspense fallback={'Loading...'}>
    <CentralAlertHistoryScene {...props} />
  </Suspense>
);

export default CentralAlertHistorySceneExposedComponent;

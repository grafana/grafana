import { Suspense, lazy } from 'react';

import { CentralAlertHistorySceneProps } from '../../../../../../../../packages/grafana-data/src/types/pluginExtensions';

const CentralAlertHistoryScene = lazy(() => import('./CentralAlertHistoryScene'));

const CentralAlertHistorySceneExposedComponent = (props: CentralAlertHistorySceneProps) => (
  <Suspense fallback={'Loading...'}>
    <CentralAlertHistoryScene {...props} />
  </Suspense>
);

export default CentralAlertHistorySceneExposedComponent;

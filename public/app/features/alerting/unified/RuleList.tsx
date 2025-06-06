import { Suspense, lazy } from 'react';

import { shouldUseAlertingListViewV2 } from './featureToggles';
import RuleListV1 from './rule-list/RuleList.v1';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const RuleListV2 = lazy(() => import('./rule-list/RuleList.v2'));

const RuleList = () => {
  const newView = shouldUseAlertingListViewV2();

  return <Suspense>{newView ? <RuleListV2 /> : <RuleListV1 />}</Suspense>;
};

export default withPageErrorBoundary(RuleList);

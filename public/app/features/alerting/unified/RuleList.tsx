import { Suspense, lazy, useEffect, useRef } from 'react';

import { trackRuleListPageView } from './Analytics';
import { shouldUseAlertingListViewV2 } from './featureToggles';
import RuleListV1 from './rule-list/RuleList.v1';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const RuleListV2 = lazy(() => import('./rule-list/RuleList.v2'));

const RuleList = () => {
  const newView = shouldUseAlertingListViewV2();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackRuleListPageView({ view: newView ? 'v2' : 'v1' });
      tracked.current = true;
    }
  }, [newView]);

  return <Suspense>{newView ? <RuleListV2 /> : <RuleListV1 />}</Suspense>;
};

export default withPageErrorBoundary(RuleList);

import { Suspense, lazy, useEffect, useRef } from 'react';

import { trackRuleListPageView } from './Analytics';
import { shouldUseAlertingListViewV2, shouldUseAlertingRulesAPIV2 } from './featureToggles';
import RuleListV1 from './rule-list/RuleList.v1';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const RuleListV2 = lazy(() => import('./rule-list/RuleList.v2'));
const RuleListAPIV2 = lazy(() => import('./rule-list/api-v2/RuleListAPIV2Page'));

const RuleList = () => {
  const apiV2 = shouldUseAlertingRulesAPIV2();
  const newView = shouldUseAlertingListViewV2();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackRuleListPageView({ view: apiV2 || newView ? 'v2' : 'v1' });
      tracked.current = true;
    }
  }, [apiV2, newView]);

  if (apiV2) {
    return (
      <Suspense>
        <RuleListAPIV2 />
      </Suspense>
    );
  }

  return <Suspense>{newView ? <RuleListV2 /> : <RuleListV1 />}</Suspense>;
};

export default withPageErrorBoundary(RuleList);

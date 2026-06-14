import { Suspense, lazy, useEffect, useRef } from 'react';

import { trackRuleListPageView } from './Analytics';
import { shouldUseAlertingListViewV2 } from './featureToggles';
import RuleListV1 from './rule-list/RuleList.v1';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const RuleListV2 = lazy(() => import('./rule-list/RuleList.v2'));

function pickRuleListView(newView: boolean): 'v1' | 'v2' {
  return newView ? 'v2' : 'v1';
}

const RuleList = () => {
  const view = pickRuleListView(shouldUseAlertingListViewV2());
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackRuleListPageView({ view });
      tracked.current = true;
    }
  }, [view]);

  return (
    <Suspense>
      {view === 'v2' && <RuleListV2 />}
      {view === 'v1' && <RuleListV1 />}
    </Suspense>
  );
};

export default withPageErrorBoundary(RuleList);

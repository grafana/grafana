import { Suspense, lazy, useEffect, useRef } from 'react';

import { trackRuleListPageView } from './Analytics';
import { shouldUseAlertingListViewV2, shouldUseRulesAPIV2 } from './featureToggles';
import RuleListV1 from './rule-list/RuleList.v1';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const RuleListV2 = lazy(() => import('./rule-list/RuleList.v2'));
const RuleListV3 = lazy(() => import('./rule-list/v3/RuleList.v3'));

function pickRuleListView(newView: boolean, rulesApiV2: boolean): 'v1' | 'v2' | 'v3' {
  if (!newView) {
    return 'v1';
  }
  return rulesApiV2 ? 'v3' : 'v2';
}

const RuleList = () => {
  const view = pickRuleListView(shouldUseAlertingListViewV2(), shouldUseRulesAPIV2());
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackRuleListPageView({ view });
      tracked.current = true;
    }
  }, [view]);

  return (
    <Suspense>
      {view === 'v3' && <RuleListV3 />}
      {view === 'v2' && <RuleListV2 />}
      {view === 'v1' && <RuleListV1 />}
    </Suspense>
  );
};

export default withPageErrorBoundary(RuleList);

import { Suspense, lazy, useEffect, useRef } from 'react';

import { useFlagAlertingListViewV3 } from '@grafana/runtime/internal';

import { trackRuleListPageView } from './Analytics';
import { shouldUseAlertingListViewV2 } from './featureToggles';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const ruleListVersions = {
  v1: lazy(() => import('./rule-list/RuleList.v1')),
  v2: lazy(() => import('./rule-list/RuleList.v2')),
  v3: lazy(() => import('./rule-list/RuleList.v3')),
};

const RuleList = () => {
  const listVersion = useRuleListVersion();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackRuleListPageView({ view: listVersion });
      tracked.current = true;
    }
  }, [listVersion]);

  const RuleListContent = ruleListVersions[listVersion];

  return (
    <Suspense>
      <RuleListContent />
    </Suspense>
  );
};

function useRuleListVersion(): keyof typeof ruleListVersions {
  const useV3 = useFlagAlertingListViewV3();
  const useV2 = shouldUseAlertingListViewV2();

  if (useV3) {
    return 'v3';
  }
  if (useV2) {
    return 'v2';
  }
  return 'v1';
}

export default withPageErrorBoundary(RuleList);

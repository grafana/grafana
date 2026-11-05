import { useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { type RuleKind } from './ruleKind';

/**
 * Reports one page view per mount, with the browsing mode the page opened in.
 * Never pass filter values, titles/UIDs, labels or folder paths - only rule kind and browsing mode.
 */
export function useTrackRuleListPageView(kind: RuleKind, mode: 'list' | 'folders') {
  useEffect(() => {
    reportInteraction('grafana_alerting_gma_rule_list_view', { kind, mode });
    // Once per mount: switching modes later is not a new page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

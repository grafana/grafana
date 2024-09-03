import { useMemo } from 'react';

import { CombinedRule } from 'app/types/unified-alerting';

import { getPendingPeriod, isGrafanaRecordingRule, isRecordingRulerRule } from '../../utils/rules';

export function usePendingPeriod(rule: CombinedRule): string | undefined {
  return useMemo(() => {
    if (isRecordingRulerRule(rule.rulerRule) || isGrafanaRecordingRule(rule.rulerRule)) {
      return;
    }
    return getPendingPeriod(rule);
  }, [rule]);
}

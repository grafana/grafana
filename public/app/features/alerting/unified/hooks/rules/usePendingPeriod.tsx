import { useMemo } from 'react';

import { CombinedRule } from 'app/types/unified-alerting';

import { isRecordingRulerRule, isRecordingRule, isAlertingRulerRule, isAlertingRule } from '../../utils/rules';
import { formatPrometheusDuration } from '../../utils/time';

export function usePendingPeriod(rule: CombinedRule): string | undefined {
  return useMemo(() => {
    if (isRecordingRulerRule(rule.rulerRule) || isRecordingRule(rule.promRule)) {
      return undefined;
    }

    if (isAlertingRulerRule(rule.rulerRule)) {
      return rule.rulerRule.for;
    }

    if (isAlertingRule(rule.promRule)) {
      const durationInMilliseconds = (rule.promRule.duration ?? 0) * 1000;
      return formatPrometheusDuration(durationInMilliseconds);
    }

    return undefined;
  }, [rule.rulerRule, rule.promRule]);
}

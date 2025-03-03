import { useMemo } from 'react';

import { CombinedRule } from 'app/types/unified-alerting';

import { getPendingPeriod } from '../../utils/rules';

export function usePendingPeriod(rule: CombinedRule): string | undefined {
  return useMemo(() => getPendingPeriod(rule), [rule]);
}

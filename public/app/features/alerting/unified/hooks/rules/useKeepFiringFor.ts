import { useMemo } from 'react';

import { CombinedRule } from 'app/types/unified-alerting';

import { getKeepFiringfor } from '../../utils/rules';

export function useKeepFiringFor(rule: CombinedRule): string | undefined {
  return useMemo(() => getKeepFiringfor(rule), [rule]);
}

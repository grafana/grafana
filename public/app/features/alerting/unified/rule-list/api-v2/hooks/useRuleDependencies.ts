import { useMemo } from 'react';

import { type RuleGroup } from 'app/types/unified-alerting';

import { detectDependencies } from '../lib/detectDependencies';
import { type ChainInfo } from '../lib/types';

export function useRuleDependencies(group: RuleGroup): ChainInfo {
  return useMemo(() => detectDependencies(group), [group]);
}

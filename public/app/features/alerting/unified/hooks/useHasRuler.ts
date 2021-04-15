import { RulesSource } from 'app/types/unified-alerting';
import { useCallback } from 'react';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

// datasource has ruler if it's grafana managed or if we're able to load rules from it
export function useHasRuler(): (rulesSource: string | RulesSource) => boolean {
  const rulerRules = useUnifiedAlertingSelector((state) => state.rulerRules);
  return useCallback(
    (rulesSource: string | RulesSource) => {
      const rulesSourceName = typeof rulesSource === 'string' ? rulesSource : rulesSource.name;
      return rulesSourceName === GRAFANA_RULES_SOURCE_NAME || !!rulerRules[rulesSourceName]?.result;
    },
    [rulerRules]
  );
}

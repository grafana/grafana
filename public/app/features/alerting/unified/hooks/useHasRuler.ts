import { useCallback } from 'react';

import { RulesSource } from 'app/types/unified-alerting';

import { getRulesSourceName, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

// datasource has ruler if it's grafana managed or if we're able to load rules from it
export function useHasRuler() {
  const rulerRules = useUnifiedAlertingSelector((state) => state.rulerRules);

  const hasRuler = useCallback(
    (rulesSource: string | RulesSource) => {
      const rulesSourceName = typeof rulesSource === 'string' ? rulesSource : rulesSource.name;
      return rulesSourceName === GRAFANA_RULES_SOURCE_NAME || !!rulerRules[rulesSourceName]?.result;
    },
    [rulerRules]
  );

  const rulerRulesLoaded = useCallback(
    (rulesSource: RulesSource) => {
      const rulesSourceName = getRulesSourceName(rulesSource);
      const result = rulerRules[rulesSourceName]?.result;

      return Boolean(result);
    },
    [rulerRules]
  );

  return { hasRuler, rulerRulesLoaded };
}

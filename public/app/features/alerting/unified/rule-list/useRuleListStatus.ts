import { useMemo } from 'react';

import { type RulesSourceDataSource } from '@grafana/alerting/internal';
import { type RuleNamespace } from 'app/types/unified-alerting';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { useGlobalRuleAbility } from '../hooks/abilities/rules/ruleAbilities';
import { RuleAction } from '../hooks/abilities/types';
import { type DataSourcesForRulesResult } from '../hooks/useDataSourcesForRules';
import { useUnifiedAlertingSelector } from '../hooks/useUnifiedAlertingSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { type AsyncRequestState } from '../utils/redux';

interface RuleListStatus {
  isLoading: boolean;
  hasNoRules: boolean;
}

export function useRuleListStatus(rulesSources: DataSourcesForRulesResult): RuleListStatus {
  const rulesSourceNames = useRulesSourceNames(rulesSources.items);
  const promRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

  const isLoading =
    rulesSources.isLoading ||
    rulesSourceNames.some((name) => promRequests[name]?.loading || rulerRequests[name]?.loading);

  // Decide "no rules" only when the list of rules sources is known, and every one of them answered.
  const hasNoRules =
    !rulesSources.isLoading &&
    !rulesSources.error &&
    rulesSourceNames.length > 0 &&
    rulesSourceNames.every((name) => hasNoPromRules(promRequests[name])) &&
    Object.values(rulerRequests).every(hasNoRulerRules);

  return { isLoading, hasNoRules };
}

/** The rules sources that the rule list requests, the same as getAllRulesSourceNames(). */
function useRulesSourceNames(dataSources: RulesSourceDataSource[]): string[] {
  const canViewGrafanaRules = useGlobalRuleAbility(RuleAction.View).granted;

  return useMemo(() => {
    const names = dataSources.map((ds) => ds.name);
    return canViewGrafanaRules ? [...names, GRAFANA_RULES_SOURCE_NAME] : names;
  }, [dataSources, canViewGrafanaRules]);
}

/** False while the request is missing, running for the first time, or failed. */
function hasNoPromRules(request?: AsyncRequestState<RuleNamespace[]>): boolean {
  return request?.result?.length === 0;
}

// Not every rules source supports the ruler API, so a failed ruler request counts as no rules.
function hasNoRulerRules(request: AsyncRequestState<RulerRulesConfigDTO | null>): boolean {
  const isFinished = request.result !== undefined || request.error !== undefined;
  return isFinished && Object.values(request.result ?? {}).every((groups) => groups.length === 0);
}

import { useListAlertRuleSearchRulesV0Alpha1Mutation } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type Criteria } from '../rule-search/criteria';

import { type AlertRuleSearchHit, toAlertRuleSearchHit } from './alertRuleSearchHit';
import { buildAlertRuleSearchQuery } from './alertRuleSearchQuery';

export interface AlertRuleSearchOptions {
  continueToken?: string;
  limit?: number;
}

export interface AlertRuleSearchPage {
  hits: AlertRuleSearchHit[];
  continueToken?: string;
}

/**
 * The single place that chooses which API endpoint serves Alert rule search; every view goes
 * through the function this returns instead of naming a generated hook.
 */
export function useAlertRuleSearch() {
  const [triggerSearch] = useListAlertRuleSearchRulesV0Alpha1Mutation();

  return async (criteria: Criteria, options: AlertRuleSearchOptions = {}): Promise<AlertRuleSearchPage> => {
    const result = await triggerSearch({
      listAlertRuleSearchRulesV0Alpha1RequestBody: buildAlertRuleSearchQuery(criteria, {
        continue: options.continueToken,
        limit: options.limit,
      }),
    }).unwrap();

    return {
      hits: result.items.map(toAlertRuleSearchHit),
      continueToken: result.metadata.continue,
    };
  };
}

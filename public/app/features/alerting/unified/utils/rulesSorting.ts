import { sortBy } from 'lodash';

import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { RuleSortOrder } from '../components/rules/RulesSortingSelector';

import { prometheusRuleType, rulerRuleType } from './rules';

const STATE_PRIORITY: Record<string, number> = {
  [PromAlertingRuleState.Firing]: 1,
  [PromAlertingRuleState.Pending]: 2,
  [PromAlertingRuleState.Recovering]: 3,
  [PromAlertingRuleState.Inactive]: 4,
  unknown: 5,
};

function getRuleState(rule: CombinedRule): string {
  if (prometheusRuleType.alertingRule(rule.promRule)) {
    return rule.promRule.state;
  }
  return 'unknown';
}

function getRuleStatePriority(rule: CombinedRule): number {
  const state = getRuleState(rule);
  return STATE_PRIORITY[state] ?? STATE_PRIORITY.unknown;
}

function getRuleCreatedTime(rule: CombinedRule): number {
  const rulerRule = rule.rulerRule;

  if (rulerRuleType.grafana.rule(rulerRule)) {
    const updatedAt = rulerRule.grafana_alert.updated;
    if (updatedAt) {
      return new Date(updatedAt).getTime();
    }
  }

  return 0;
}

function getRuleUpdatedTime(rule: CombinedRule): number {
  const rulerRule = rule.rulerRule;

  if (rulerRuleType.grafana.rule(rulerRule)) {
    const updatedAt = rulerRule.grafana_alert.updated;
    if (updatedAt) {
      return new Date(updatedAt).getTime();
    }
  }

  if (prometheusRuleType.alertingRule(rule.promRule)) {
    const lastEval = rule.promRule.lastEvaluation;
    if (lastEval) {
      return new Date(lastEval).getTime();
    }
  }

  return 0;
}

export function sortRules(rules: CombinedRule[], sortOrder: RuleSortOrder | undefined): CombinedRule[] {
  if (!sortOrder) {
    return rules;
  }

  switch (sortOrder) {
    case RuleSortOrder.AlphaAsc:
      return sortBy(rules, [(rule) => rule.name.toLowerCase()]);

    case RuleSortOrder.AlphaDesc:
      return sortBy(rules, [(rule) => rule.name.toLowerCase()]).reverse();

    case RuleSortOrder.StateAsc:
      return sortBy(rules, [
        (rule) => getRuleStatePriority(rule),
        (rule) => rule.name.toLowerCase(),
      ]);

    case RuleSortOrder.StateDesc:
      return sortBy(rules, [
        (rule) => -getRuleStatePriority(rule),
        (rule) => rule.name.toLowerCase(),
      ]);

    case RuleSortOrder.CreatedAsc:
      return sortBy(rules, [
        (rule) => getRuleCreatedTime(rule),
        (rule) => rule.name.toLowerCase(),
      ]);

    case RuleSortOrder.CreatedDesc:
      return sortBy(rules, [
        (rule) => -getRuleCreatedTime(rule),
        (rule) => rule.name.toLowerCase(),
      ]);

    case RuleSortOrder.UpdatedAsc:
      return sortBy(rules, [
        (rule) => getRuleUpdatedTime(rule),
        (rule) => rule.name.toLowerCase(),
      ]);

    case RuleSortOrder.UpdatedDesc:
      return sortBy(rules, [
        (rule) => -getRuleUpdatedTime(rule),
        (rule) => rule.name.toLowerCase(),
      ]);

    default:
      return rules;
  }
}

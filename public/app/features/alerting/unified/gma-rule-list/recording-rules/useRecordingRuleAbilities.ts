import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { type RuleAbilities, getRuleAbilities, useRuleFolderAccess } from '../rule-row/ruleAbilities';

export function useRecordingRuleAbilities(rule: RecordingRule): RuleAbilities {
  const folderAccess = useRuleFolderAccess(rule);
  return getRuleAbilities(rule, folderAccess);
}

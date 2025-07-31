import { t } from '@grafana/i18n';
import { EditableRuleIdentifier, RuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { deleteRuleAction } from '../../reducers/ruler/ruleGroups';
import { useAsync } from '../useAsync';

import { useProduceNewRuleGroup } from './useProduceNewRuleGroup';

/**
 * Delete a single rule from a (ruler) group. This hook will ensure that mutations on the rule group are safe and will always
 * use the latest definition of the ruler group identifier.
 *
 * If no more rules are left in the group it will remove the entire group instead of updating.
 */
export function useDeleteRuleFromGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, ruleIdentifier: EditableRuleIdentifier) => {
    const { groupName, namespaceName } = ruleGroup;

    const action = deleteRuleAction({ identifier: ruleIdentifier });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, [action]);

    const successMessage = t('alerting.rules.delete-rule.success', 'Rule successfully deleted');

    // if we have no more rules left after reducing, remove the entire group
    if (newRuleGroupDefinition.rules.length === 0) {
      return deleteRuleGroup({
        rulerConfig,
        namespace: namespaceName,
        group: groupName,
        notificationOptions: { successMessage },
      }).unwrap();
    }

    // otherwise just update the group
    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      notificationOptions: { successMessage },
    }).unwrap();
  });
}

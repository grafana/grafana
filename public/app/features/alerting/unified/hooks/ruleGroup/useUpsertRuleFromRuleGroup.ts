import { produce } from 'immer';
import { isEqual } from 'lodash';

import { t } from '@grafana/i18n';
import { EditableRuleIdentifier, RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { addRuleAction, updateRuleAction } from '../../reducers/ruler/ruleGroups';
import { isGrafanaRuleIdentifier, rulerRuleType } from '../../utils/rules';
import { useAsync } from '../useAsync';

import { useDeleteRuleFromGroup } from './useDeleteRuleFromGroup';
import { useProduceNewRuleGroup } from './useProduceNewRuleGroup';

/**
 * This hook will add a single rule to a rule group – a new rule group will be created if it does not already exist.
 */
export function useAddRuleToRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  const successMessage = t('alerting.rules.add-rule.success', 'Rule added successfully');

  return useAsync(async (ruleGroup: RuleGroupIdentifier, rule: PostableRuleDTO, interval?: string) => {
    const { namespaceName } = ruleGroup;

    // the new rule might have to be created in a new group, pass name and interval (optional) to the action
    const action = addRuleAction({ rule, interval, groupName: ruleGroup.groupName });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, [action]);

    const result = upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      notificationOptions: { successMessage },
    }).unwrap();

    return result;
  });
}

/**
 * This hook will update an existing rule within a rule group, does not support moving the rule to another namespace / group
 */
export function useUpdateRuleInRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [moveRuleToGroup] = useMoveRuleToRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  const successMessage = t('alerting.rules.update-rule.success', 'Rule updated successfully');

  return useAsync(
    async (
      ruleGroup: RuleGroupIdentifier,
      ruleIdentifier: EditableRuleIdentifier,
      ruleDefinition: PostableRuleDTO,
      targetRuleGroup?: RuleGroupIdentifier,
      interval?: string
    ) => {
      const { namespaceName } = ruleGroup;
      const finalRuleDefinition = copyGrafanaUID(ruleIdentifier, ruleDefinition);

      // check if the existing rule and the form values have the same rule group identifier
      const sameTargetRuleGroup = isEqual(ruleGroup, targetRuleGroup);
      if (targetRuleGroup && !sameTargetRuleGroup) {
        const result = moveRuleToGroup.execute(ruleGroup, targetRuleGroup, ruleIdentifier, ruleDefinition, interval);
        return result;
      }

      const action = updateRuleAction({ identifier: ruleIdentifier, rule: finalRuleDefinition });
      const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, [action]);

      return upsertRuleGroup({
        rulerConfig,
        namespace: namespaceName,
        payload: newRuleGroupDefinition,
        notificationOptions: { successMessage },
      }).unwrap();
    }
  );
}

/**
 * This hook will move an existing rule to another namespace or group. The rule definition can also be modified.
 * For Grafana-managed rules we can perform a single atomic move operation by copying the rule UID from the previous rule definition.
 */
export function useMoveRuleToRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  const successMessage = t('alerting.rules.update-rule.success', 'Rule updated successfully');

  return useAsync(
    async (
      currentRuleGroup: RuleGroupIdentifier,
      targetRuleGroup: RuleGroupIdentifier,
      ruleIdentifier: EditableRuleIdentifier,
      ruleDefinition: PostableRuleDTO,
      interval?: string
    ) => {
      const finalRuleDefinition = copyGrafanaUID(ruleIdentifier, ruleDefinition);

      // 1. add the rule to the new namespace / group / ruler target
      const addRuleToGroup = addRuleAction({ rule: finalRuleDefinition, interval });
      const { newRuleGroupDefinition: newTargetGroup, rulerConfig: targetGroupRulerConfig } = await produceNewRuleGroup(
        targetRuleGroup,
        [addRuleToGroup]
      );

      const result = await upsertRuleGroup({
        rulerConfig: targetGroupRulerConfig,
        namespace: targetRuleGroup.namespaceName,
        payload: newTargetGroup,
        notificationOptions: { successMessage },
      }).unwrap();

      // 2. if not Grafana-managed: remove the rule from the existing namespace / group / ruler
      if (!isGrafanaRuleIdentifier(ruleIdentifier)) {
        await deleteRuleFromGroup.execute(currentRuleGroup, ruleIdentifier);
      }

      return result;
    }
  );
}

function copyGrafanaUID(ruleIdentifier: EditableRuleIdentifier, ruleDefinition: PostableRuleDTO) {
  const isGrafanaManagedRuleIdentifier = isGrafanaRuleIdentifier(ruleIdentifier);

  // by copying over the rule UID the backend will perform an atomic move operation
  // so there is no need for us to manually remove it from the previous group
  return produce(ruleDefinition, (draft) => {
    const isGrafanaManagedRuleDefinition = rulerRuleType.grafana.rule(draft);

    if (isGrafanaManagedRuleIdentifier && isGrafanaManagedRuleDefinition) {
      draft.grafana_alert.uid = ruleIdentifier.uid;
    }
  });
}

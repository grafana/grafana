import { produce } from 'immer';
import { uniq } from 'lodash';

import { t } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';
import { RuleGroupIdentifier, EditableRuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { addRuleAction, updateRuleAction } from '../../reducers/ruler/ruleGroups';
import { fetchRulerRulesAction } from '../../state/actions';
import { isGrafanaRuleIdentifier, isGrafanaRulerRule } from '../../utils/rules';
import { useAsync } from '../useAsync';

import { useDeleteRuleFromGroup } from './useDeleteRuleFromGroup';
import { useProduceNewRuleGroup } from './useProduceNewRuleGroup';

const addSuccessMessage = t('alerting.rules.add-rule.success', 'Rule added successfully');
const updateSuccessMessage = t('alerting.rules.update-rule.success', 'Rule updated successfully');

/**
 * This hook will add a single rule to a rule group – a new rule group will be created if it does not already exist.
 */
export function useAddRuleToRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, rule: PostableRuleDTO) => {
    const { namespaceName, dataSourceName } = ruleGroup;

    const action = addRuleAction({ rule });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    const result = upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      requestOptions: { successMessage: addSuccessMessage },
    }).unwrap();

    // @TODO remove
    await dispatch(fetchRulerRulesAction({ rulesSourceName: dataSourceName }));

    return result;
  });
}

/**
 * This hook will update an existing rule within a rule group, does not support moving the rule to another namespace / group
 */
export function useUpdateRuleInRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, identifier: EditableRuleIdentifier, rule: PostableRuleDTO) => {
    const { dataSourceName, namespaceName } = ruleGroup;

    const action = updateRuleAction({ identifier, rule });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    const result = upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      requestOptions: { successMessage: updateSuccessMessage },
    }).unwrap();

    // @TODO remove
    await dispatch(fetchRulerRulesAction({ rulesSourceName: dataSourceName }));

    return result;
  });
}

/**
 * This hook will move an existing rule to another namespace or group. The rule definition can also be modified.
 * For Grafana-managed rules we can perform a single atomic move operation by copying the rule UID from the previous rule definition.
 */
export function useMoveRuleToRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [_deleteRuleState, deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(
    async (
      currentRuleGroup: RuleGroupIdentifier,
      targetRuleGroup: RuleGroupIdentifier,
      ruleIdentifier: EditableRuleIdentifier,
      ruleDefinition: PostableRuleDTO
    ) => {
      const isGrafanaManagedRuleIdentifier = isGrafanaRuleIdentifier(ruleIdentifier);

      // by copying over the rule UID the backend will perform an atomic move operation
      // so there is no need for us to manually remove it from the previous group
      const finalRuleDefinition = produce(ruleDefinition, (draft) => {
        const isGrafanaManagedRuleDefinition = isGrafanaRulerRule(draft);

        if (isGrafanaManagedRuleIdentifier && isGrafanaManagedRuleDefinition) {
          draft.grafana_alert.uid = ruleIdentifier.uid;
        }
      });

      // 1. add the rule to the new namespace / group / ruler target
      const addRuleToGroup = addRuleAction({ rule: finalRuleDefinition });
      const { newRuleGroupDefinition: newTargetGroup, rulerConfig: targetGroupRulerConfig } = await produceNewRuleGroup(
        targetRuleGroup,
        addRuleToGroup
      );

      const result = await upsertRuleGroup({
        rulerConfig: targetGroupRulerConfig,
        namespace: currentRuleGroup.namespaceName,
        payload: newTargetGroup,
        requestOptions: { successMessage: updateSuccessMessage },
      }).unwrap();

      // 2. if not Grafana-managed: remove the rule from the existing namespace / group / ruler
      if (!isGrafanaManagedRuleIdentifier) {
        await deleteRuleFromGroup.execute(currentRuleGroup, ruleIdentifier);
      }

      // @TODO remove when RTKQ tags
      const refetchDataSources = uniq([currentRuleGroup.dataSourceName, targetRuleGroup.dataSourceName]).map(
        (rulesSourceName) => {
          return dispatch(fetchRulerRulesAction({ rulesSourceName }));
        }
      );

      // using all-settled because we don't care if this fails, that doesn't incidate that the move itself has failed
      await Promise.allSettled(refetchDataSources);

      return result;
    }
  );
}

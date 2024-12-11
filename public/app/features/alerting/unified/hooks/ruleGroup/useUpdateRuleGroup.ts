import { t } from 'app/core/internationalization';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { notFoundToNullOrThrow } from '../../api/util';
import {
  moveRuleGroupAction,
  renameRuleGroupAction,
  reorderRulesInRuleGroupAction,
  updateRuleGroupAction,
} from '../../reducers/ruler/ruleGroups';
import { isGrafanaRulesSource } from '../../utils/datasource';
import { useAsync } from '../useAsync';

import { useProduceNewRuleGroup } from './useProduceNewRuleGroup';

const ruleUpdateSuccessMessage = () => t('alerting.rule-groups.update.success', 'Successfully updated rule group');

/**
 * Update an existing rule group, currently only supports updating the interval.
 * Use "useRenameRuleGroup" or "useMoveRuleGroup" for updating the namespace or group name.
 */
export function useUpdateRuleGroupConfiguration() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, interval: string) => {
    const { namespaceName } = ruleGroup;

    const action = updateRuleGroupAction({ interval });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      notificationOptions: { successMessage: ruleUpdateSuccessMessage() },
    }).unwrap();
  });
}

/**
 * Move a rule group to either another namespace with (optionally) a different name, throws if the action
 * targets an existing rule group.
 * Optionally, update the rule group evaluation interval.
 */
export function useMoveRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [fetchRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  // @TODO maybe add where we moved it from and to for additional peace of mind
  const successMessage = t('alerting.rule-groups.move.success', 'Successfully moved rule group');

  return useAsync(
    async (ruleGroup: RuleGroupIdentifier, namespaceName: string, groupName?: string, interval?: string) => {
      // we could technically support moving rule groups to another folder, though we don't have a "move" wizard yet.
      if (isGrafanaRulesSource(ruleGroup.dataSourceName)) {
        throw new Error('Moving a Grafana-managed rule group to another folder is currently not supported.');
      }

      const action = moveRuleGroupAction({ newNamespaceName: namespaceName, groupName, interval });
      const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

      const oldNamespace = ruleGroup.namespaceName;
      const targetNamespace = action.payload.newNamespaceName;

      const oldGroupName = ruleGroup.groupName;
      const targetGroupName = action.payload.groupName;

      const isGroupRenamed = Boolean(targetGroupName) && oldGroupName !== targetGroupName;

      // if we're also renaming the group, check if the target does not already exist
      if (targetGroupName && isGroupRenamed) {
        const targetGroup = await fetchRuleGroup({
          rulerConfig,
          namespace: targetNamespace,
          group: targetGroupName,
          // since this could throw 404
          notificationOptions: { showErrorAlert: false },
        })
          .unwrap()
          .catch(notFoundToNullOrThrow);

        if (targetGroup?.rules?.length) {
          throw new Error('Target group already has rules, merging rule groups is currently not supported.');
        }
      }

      // create the new group in the target namespace
      // ⚠️ it's important to do this before we remove the old group – better to have two groups than none if one of these requests fails
      await upsertRuleGroup({
        rulerConfig,
        namespace: targetNamespace,
        payload: newRuleGroupDefinition,
        notificationOptions: { successMessage },
      }).unwrap();

      // now remove the old one
      const result = await deleteRuleGroup({
        rulerConfig,
        namespace: oldNamespace,
        group: oldGroupName,
        notificationOptions: { showSuccessAlert: false },
      }).unwrap();

      return result;
    }
  );
}

/**
 * Rename a rule group but keep it within the same namespace, throws if the action targets an existing rule group.
 * Optionally, update the rule group evaluation interval.
 */
export function useRenameRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [fetchRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, groupName: string, interval?: string) => {
    const action = renameRuleGroupAction({ groupName, interval });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    const oldGroupName = ruleGroup.groupName;
    const newGroupName = action.payload.groupName;
    const namespaceName = ruleGroup.namespaceName;

    const successMessage = t('alerting.rule-groups.rename.success', 'Successfully renamed rule group');

    // check if the target group exists
    const targetGroup = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: newGroupName,
      // since this could throw 404
      notificationOptions: { showErrorAlert: false },
    })
      .unwrap()
      .catch(notFoundToNullOrThrow);

    if (targetGroup?.rules?.length) {
      throw new Error('Target group has existing rules, merging rule groups is currently not supported.');
    }

    // if the target group does not exist, create the new group
    // ⚠️ it's important to do this before we remove the old group – better to have two groups than none if one of these requests fails
    const result = await upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      notificationOptions: { successMessage },
    }).unwrap();

    // now delete the group we renamed
    await deleteRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: oldGroupName,
      notificationOptions: { showSuccessAlert: false },
    }).unwrap();

    return result;
  });
}

/**
 * Reorder rules within an existing rule group. Pass in an array of swap operations Array<[oldIndex, newIndex]>.
 * This prevents rules from accidentally being updated and only allows indices to be moved around.
 */
export function useReorderRuleForRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, swaps: Array<[number, number]>) => {
    const { namespaceName } = ruleGroup;

    const action = reorderRulesInRuleGroupAction({ swaps });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
      notificationOptions: { successMessage: ruleUpdateSuccessMessage() },
    }).unwrap();
  });
}

import { Action } from '@reduxjs/toolkit';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { notFoundToNullOrThrow } from '../api/util';
import {
  deleteRuleAction,
  moveRuleGroupAction,
  pauseRuleAction,
  renameRuleGroupAction,
  ruleGroupReducer,
  updateRuleGroupAction,
} from '../reducers/ruler/ruleGroups';
import { fetchRulesSourceBuildInfoAction, getDataSourceRulerConfig } from '../state/actions';
import { isGrafanaRulesSource } from '../utils/datasource';

import { useAsync } from './useAsync';

/**
 * Hook for reuse that handles freshly fetching a rule group's definition, applying an action to it,
 * and then performing the API mutations necessary to persist the change.
 *
 * All rule groups changes should ideally be implemented as a wrapper around this hook,
 * to ensure that we always protect as best we can against accidentally overwriting changes,
 * and to guard against user concurrency issues.
 *
 * @throws
 */
function useProduceNewRuleGroup() {
  const [fetchRuleGroup, requestState] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();

  /**
   * This function will fetch the latest configuration we have for the rule group, apply a diff to it via a reducer and sends
   * returns the result.
   *
   * The API does not allow operations on a single rule and will always overwrite the existing rule group with the payload.
   *
   * ┌─────────────────────────┐  ┌───────────────┐  ┌──────────────────┐
   * │ fetch latest rule group │─▶│ apply reducer │─▶│  new rule group  │
   * └─────────────────────────┘  └───────────────┘  └──────────────────┘
   */
  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, action: Action) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: dataSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    const latestRuleGroupDefinition = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: groupName,
    }).unwrap();

    const newRuleGroupDefinition = ruleGroupReducer(latestRuleGroupDefinition, action);

    return { newRuleGroupDefinition, rulerConfig };
  };

  return [produceNewRuleGroup, requestState] as const;
}

/**
 * Pause a single rule in a (ruler) group. This hook will ensure that mutations on the rule group are safe and will always
 * use the latest definition of the ruler group identifier.
 */
export function usePauseRuleInGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();

  return useAsync(async (ruleGroup: RuleGroupIdentifier, uid: string, pause: boolean) => {
    const { namespaceName } = ruleGroup;

    const action = pauseRuleAction({ uid, pause });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
    }).unwrap();
  });
}

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

  return useAsync(async (ruleGroup: RuleGroupIdentifier, rule: RulerRuleDTO) => {
    const { groupName, namespaceName } = ruleGroup;

    const action = deleteRuleAction({ rule });
    const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

    // if we have no more rules left after reducing, remove the entire group
    if (newRuleGroupDefinition.rules.length === 0) {
      return deleteRuleGroup({
        rulerConfig,
        namespace: namespaceName,
        group: groupName,
      }).unwrap();
    }

    // otherwise just update the group
    return upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
    }).unwrap();
  });
}

/**
 * Update an existing rule group
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
    }).unwrap();
  });
}

/**
 * Move a rule group to either another namespace with (optionally) a different name, throws if the action
 * targets an existing rule group
 */
export function useMoveRuleGroup() {
  const [produceNewRuleGroup] = useProduceNewRuleGroup();
  const [fetchRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  return useAsync(
    async (ruleGroup: RuleGroupIdentifier, namespaceName: string, groupName?: string, interval?: string) => {
      // we could technically support moving rule groups to another folder, though we don't have a "move" wizard yet.
      if (isGrafanaRulesSource(ruleGroup.dataSourceName)) {
        throw new Error('Moving a Grafana-managed rule group to another folder is currently not supported.');
      }

      const action = moveRuleGroupAction({ namespaceName, groupName, interval });
      const { newRuleGroupDefinition, rulerConfig } = await produceNewRuleGroup(ruleGroup, action);

      const oldNamespace = ruleGroup.namespaceName;
      const targetNamespace = action.payload.namespaceName;

      const oldGroupName = ruleGroup.groupName;
      const targetGroupName = action.payload.groupName;

      const isGroupRenamed = Boolean(targetGroupName) && oldGroupName !== targetGroupName;

      // if we're also renaming the group, check if the target does not already exist
      if (targetGroupName && isGroupRenamed) {
        const targetGroup = await fetchRuleGroup({
          rulerConfig,
          namespace: targetNamespace,
          group: targetGroupName,
        })
          .unwrap()
          .catch(notFoundToNullOrThrow);

        if (targetGroup?.rules?.length) {
          throw new Error('Target group already has rules, merging rule groups is currently not supported.');
        }
      }

      // create the new group in the target namespace
      await upsertRuleGroup({
        rulerConfig,
        namespace: targetNamespace,
        payload: newRuleGroupDefinition,
      }).unwrap();

      const result = await deleteRuleGroup({
        rulerConfig,
        namespace: oldNamespace,
        group: oldGroupName,
      }).unwrap();

      return result;
    }
  );
}

/**
 * Rename a rule group but keep it within the same namespace, throws if the action targets an existing rule group
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

    // check if the target group exists
    const targetGroup = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: newGroupName,
    })
      .unwrap()
      .catch(notFoundToNullOrThrow);

    if (targetGroup?.rules?.length) {
      throw new Error('Target group has existing rules, merging rule groups is currently not supported.');
    }

    // if the target group does not exist, create the new group
    const result = await upsertRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      payload: newRuleGroupDefinition,
    }).unwrap();

    // now delete the group we renamed
    await deleteRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: oldGroupName,
    }).unwrap();

    return result;
  });
}

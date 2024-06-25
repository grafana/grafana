import { Action } from '@reduxjs/toolkit';
import { useCallback, useState } from 'react';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { AlertGroupUpdated, alertRuleApi } from '../api/alertRuleApi';
import { notFoundToNull } from '../api/util';
import {
  deleteRuleAction,
  moveRuleGroupAction,
  pauseRuleAction,
  renameRuleGroupAction,
  ruleGroupReducer,
  updateRuleGroupAction,
} from '../reducers/ruler/ruleGroups';
import { fetchRulerRulesAction, fetchRulesSourceBuildInfoAction, getDataSourceRulerConfig } from '../state/actions';
import { isGrafanaRulesSource } from '../utils/datasource';

type ProduceResult = RulerRuleGroupDTO | AlertGroupUpdated;
type RequestState = {
  isUninitialized: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  result?: ProduceResult;
  error?: unknown;
};

/**
 * Hook for reuse that handles freshly fetching a rule group's definition, applying an action to it,
 * and then performing the API mutations necessary to persist the change.
 *
 * All rule groups changes should ideally be implemented as a wrapper around this hook,
 * to ensure that we always protect as best we can against accidentally overwriting changes,
 * and to guard against user concurrency issues.
 *
 * @throws
 * @TODO the manual state tracking here is not great, but I don't have a better idea that works /shrug
 */
function useProduceNewRuleGroup() {
  const [fetchRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [upsertRuleGroup] = alertRuleApi.endpoints.upsertRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  const [isPending, setPending] = useState<boolean>(false);
  const [isUninitialized, setUninitialized] = useState<boolean>(true);
  const [result, setResult] = useState<ProduceResult | undefined>();
  const [error, setError] = useState<unknown | undefined>();

  const isError = Boolean(error);
  const isSuccess = !isUninitialized && !isPending && !isError;

  const requestState: RequestState = {
    isUninitialized,
    isPending,
    isSuccess,
    isError,
    result,
    error,
  };

  /**
   * This function will fetch the latest we have on the rule group, apply a diff to it via a reducer and sends
   * the new rule group update to the correct endpoint.
   *
   * The API does not allow operations on a single rule and will always overwrite the existing rule group with the payload.
   *
   * ┌─────────────────────────┐  ┌───────────────┐  ┌───────────────────┐
   * │ fetch latest rule group │─▶│ apply reducer │─▶│ update rule group │
   * └─────────────────────────┘  └───────────────┘  └───────────────────┘
   */
  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, action: Action) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: dataSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    setUninitialized(false);
    setPending(true);

    try {
      const latestRuleGroupDefinition = await fetchRuleGroup({
        rulerConfig,
        namespace: namespaceName,
        group: groupName,
      }).unwrap();

      // @TODO convert rule group to postable rule group – TypeScript is not complaining here because
      // the interfaces are compatible but it _should_ complain
      const newRuleGroup = ruleGroupReducer(latestRuleGroupDefinition, action);

      let actionsDeferred: () => Promise<ProduceResult> = () => {
        return upsertRuleGroup({
          rulerConfig,
          namespace: namespaceName,
          payload: newRuleGroup,
        }).unwrap();
      };

      /*
       * DELETE: if we are deleting a rule, check if we need to delete the entire group instead
       */
      if (deleteRuleAction.match(action)) {
        // if we have no more rules left after reducing, remove the entire group
        if (newRuleGroup.rules.length === 0) {
          return deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: groupName,
          }).unwrap();
        }

        // otherwise just update the rule group
        return actionsDeferred();
      }

      /**
       * RENAME
       * 1. check if we are overwriting a target group
       * 2. if not, create the new rule group
       * 3. delete the old rule group
       */
      if (renameRuleGroupAction.match(action)) {
        const oldGroupName = groupName;
        const newGroupName = action.payload.groupName;

        actionsDeferred = async () => {
          const targetGroup = await fetchRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: newGroupName,
          })
            .unwrap()
            .catch(notFoundToNull);

          if (targetGroup?.rules?.length) {
            throw new Error('Target group has existing rules, merging rule groups is currently not supported.');
          }

          const result = await upsertRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            payload: newRuleGroup,
          }).unwrap();

          await deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: oldGroupName,
          }).unwrap();

          return result;
        };
      }

      /**
       * MOVE: only supported for data source managed rule groups for now
       * 1. create the new rule group
       * 2. delete the old one
       */
      if (moveRuleGroupAction.match(action)) {
        actionsDeferred = async () => {
          const oldNamespace = namespaceName;

          const targetNamespace = action.payload.namespaceName;
          const targetGroupName = action.payload.groupName ?? groupName;

          const targetGroup = await fetchRuleGroup({
            rulerConfig,
            namespace: targetNamespace,
            group: targetGroupName,
          })
            .unwrap()
            .catch(notFoundToNull);

          if (targetGroup?.rules?.length) {
            throw new Error('Target group already has rules, merging rule groups is currently not supported.');
          }

          await upsertRuleGroup({
            rulerConfig,
            namespace: targetNamespace,
            payload: newRuleGroup,
          }).unwrap();

          const result = await deleteRuleGroup({
            rulerConfig,
            namespace: oldNamespace,
            group: groupName,
          }).unwrap();

          return result;
        };
      }

      const result = await actionsDeferred();
      setResult(result);

      return result;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      setPending(false);
    }
  };

  return [produceNewRuleGroup, requestState] as const;
}

/**
 * Pause a single rule in a (ruler) group. This hook will ensure that mutations on the rule group are safe and will always
 * use the latest definition of the ruler group identifier.
 */
export function usePauseRuleInGroup() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const pauseFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, uid: string, pause: boolean) => {
      const action = pauseRuleAction({ uid, pause });

      return produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [pauseFn, produceNewRuleGroupState] as const;
}

/**
 * Delete a single rule from a (ruler) group. This hook will ensure that mutations on the rule group are safe and will always
 * use the latest definition of the ruler group identifier.
 *
 * If no more rules are left in the group it will remove the entire group instead of updating.
 */
export function useDeleteRuleFromGroup() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const deleteFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, rule: RulerRuleDTO) => {
      const action = deleteRuleAction({ rule });

      return produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [deleteFn, produceNewRuleGroupState] as const;
}

/**
 * Update an existing rule group
 */
export function useUpdateRuleGroupConfiguration() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    (ruleGroup: RuleGroupIdentifier, interval: string) => {
      const action = updateRuleGroupAction({ interval });

      return produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, produceNewRuleGroupState] as const;
}

/**
 * Move a rule group to either another namespace with (optionally) a different name
 */
export function useMoveRuleGroup() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const moveFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, namespaceName: string, groupName?: string, interval?: string) => {
      const { dataSourceName } = ruleGroup;

      // we could technically support moving rule groups to another folder, though we don't have a "move" wizard yet.
      // Here's what we'd need to do to support this:
      //  1.
      if (isGrafanaRulesSource(dataSourceName)) {
        throw new Error('Moving a Grafana-managed rule group to another folder is currently not supported.');
      }

      const action = moveRuleGroupAction({ namespaceName, groupName, interval });
      const result = produceNewRuleGroup(ruleGroup, action);

      // @TODO deprecate this once we've moved everything to RTKQ
      await dispatch(fetchRulerRulesAction({ rulesSourceName: dataSourceName }));

      return result;
    },
    [produceNewRuleGroup]
  );

  return [moveFn, produceNewRuleGroupState] as const;
}

/**
 * Rename a rule group but keep it within the same namespace
 */
export function useRenameRuleGroup() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const renameFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, groupName: string, interval?: string) => {
      const action = renameRuleGroupAction({ groupName, interval });
      return produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [renameFn, produceNewRuleGroupState] as const;
}

export function anyOfRequestState(...states: RequestState[]): RequestState {
  return {
    isUninitialized: states.every((s) => s.isUninitialized),
    isPending: states.some((s) => s.isPending),
    isSuccess: states.some((s) => s.isSuccess),
    isError: states.some((s) => s.isError),
    result: states.find((s) => s.result)?.result,
    error: states.find((s) => s.error)?.error,
  };
}

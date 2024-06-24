import { Action } from '@reduxjs/toolkit';
import { useCallback, useState } from 'react';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { AlertGroupUpdated, alertRuleApi } from '../api/alertRuleApi';
import {
  deleteRuleAction,
  moveRuleGroupAction,
  pauseRuleAction,
  renameRuleGroupAction,
  ruleGroupReducer,
  updateRuleGroupAction,
} from '../reducers/ruler/ruleGroups';
import { fetchRulesSourceBuildInfoAction, getDataSourceRulerConfig } from '../state/actions';

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

      // if we have no more rules left after reducing, remove the entire group
      let updateRuleGroupDeferred: () => Promise<ProduceResult> = () => {
        return upsertRuleGroup({
          rulerConfig,
          namespace: namespaceName,
          payload: newRuleGroup,
        }).unwrap();
      };

      // if we are deleting a rule, check if we need to delete the entire group instead
      if (deleteRuleAction.match(action)) {
        if (newRuleGroup.rules.length === 0) {
          return deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: groupName,
          }).unwrap();
        }

        return updateRuleGroupDeferred();
      }

      // if we are renaming a rule:
      // 1. create the new rule group
      // 2. delete the old rule group
      if (renameRuleGroupAction.match(action)) {
        updateRuleGroupDeferred = async () => {
          const result = await upsertRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            payload: newRuleGroup,
          }).unwrap();

          await deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: groupName,
          }).unwrap();

          return result;
        };
      }

      if (moveRuleGroupAction.match(action)) {
        updateRuleGroupDeferred = async () => {
          // @todo create new namespace
          // await updateRuleGroup({
          //   rulerConfig,
          //   namespace: namespaceName,
          //   payload: newRuleGroup,
          // }).unwrap();

          const result = await deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: groupName,
          }).unwrap();

          return result;
        };
      }

      const result = await updateRuleGroupDeferred();
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
 * @todo re-implement "unifiedalerting/updateLotexNamespaceAndGroup" action
 */
export function useMoveRuleGroup() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const moveFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, namespaceName: string, groupName?: string, interval?: string) => {
      const action = moveRuleGroupAction({ namespaceName, groupName, interval });
      return produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [moveFn, produceNewRuleGroupState] as const;
}

/**
 * Rename a rule group within the same namespace
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

export function anyRequestState(...states: RequestState[]): RequestState {
  return {
    isUninitialized: states.every((s) => s.isUninitialized),
    isPending: states.some((s) => s.isPending),
    isSuccess: states.some((s) => s.isSuccess),
    isError: states.some((s) => s.isError),
    result: states.find((s) => s.result)?.result,
    error: states.find((s) => s.error)?.error,
  };
}

import { Action } from '@reduxjs/toolkit';
import { useCallback, useState } from 'react';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { AlertGroupUpdated, alertRuleApi } from '../api/alertRuleApi';
import { deleteRuleAction, pauseRuleAction, ruleGroupReducer } from '../reducers/ruler/ruleGroups';
import { fetchRulesSourceBuildInfoAction, getDataSourceRulerConfig } from '../state/actions';

type ProduceResult = RulerRuleGroupDTO | AlertGroupUpdated;

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
  const [updateRuleGroup] = alertRuleApi.endpoints.updateRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useMutation();

  const [isLoading, setLoading] = useState<boolean>(false);
  const [isUninitialized, setUninitialized] = useState<boolean>(true);
  const [result, setResult] = useState<ProduceResult | undefined>();
  const [error, setError] = useState<unknown | undefined>();

  const isError = Boolean(error);
  const isSuccess = !isUninitialized && !isLoading && !isError;

  const requestState = {
    isUninitialized,
    isLoading,
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
    setLoading(true);

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
      const updateOrDeleteFunction = () => {
        if (newRuleGroup.rules.length === 0) {
          return deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: groupName,
          }).unwrap();
        }

        return updateRuleGroup({
          rulerConfig,
          namespace: namespaceName,
          payload: newRuleGroup,
        }).unwrap();
      };

      const result = await updateOrDeleteFunction();
      setResult(result);

      return result;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      setLoading(false);
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

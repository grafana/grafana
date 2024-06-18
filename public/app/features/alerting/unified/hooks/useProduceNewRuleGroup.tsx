import { Action } from '@reduxjs/toolkit';
import { useCallback, useState } from 'react';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO, RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { AlertGroupUpdated, alertRuleApi } from '../api/alertRuleApi';
import { deleteRuleAction, pauseRuleAction, ruleGroupReducer } from '../reducers/ruler/ruleGroups';
import { fetchRulesSourceBuildInfoAction, getDataSourceRulerConfig } from '../state/actions';

type ProduceResult = RulerRuleGroupDTO | AlertGroupUpdated;

// @TODO the manual state tracking here is not great, but I don't have a better idea that works /shrug
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

  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, action: Action) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: dataSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    setUninitialized(false);
    setLoading(true);

    try {
      const currentRuleGroup = await fetchRuleGroup({
        rulerConfig,
        namespace: namespaceName,
        group: groupName,
      }).unwrap();

      // @TODO convert rule group to postable rule group – TypeScript is not complaining here because
      // the interfaces are compatible but it _should_ complain
      const newRuleGroup = ruleGroupReducer(currentRuleGroup, action);

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

export function usePauseRuleInGroup() {
  const [produceNewRuleGroup, produceNewRuleGroupState] = useProduceNewRuleGroup();

  const pauseFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, rule: RulerGrafanaRuleDTO, pause: boolean) => {
      const uid = rule.grafana_alert.uid;
      const action = pauseRuleAction({ uid, pause });

      return produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [pauseFn, produceNewRuleGroupState] as const;
}

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

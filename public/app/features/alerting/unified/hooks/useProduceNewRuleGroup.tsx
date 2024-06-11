import { Action } from '@reduxjs/toolkit';
import { useCallback, useState } from 'react';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { deleteRuleAction, pauseRuleAction, ruleGroupReducer } from '../reducers/ruler/ruleGroups';
import { fetchRulesSourceBuildInfoAction, getDataSourceRulerConfig } from '../state/actions';

// @TODO the manual state tracking here is abysmal but we don't have a better idea that works right now
function useProduceNewRuleGroup() {
  const [fetchRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [updateRuleGroup] = alertRuleApi.endpoints.updateRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useLazyQuery();

  const [isLoading, setLoading] = useState<boolean>(false);
  const [isSuccess, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<unknown | undefined>();

  const requestState = {
    isUninitialized: !isLoading && !error && !isSuccess,
    isLoading,
    isSuccess,
    isError: Boolean(error),
    error,
  };

  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, action: Action) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: dataSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    setLoading(true);

    const currentRuleGroup = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: groupName,
    })
      .unwrap()
      .catch((error) => {
        setError(error);
        setSuccess(false);
      });

    if (!currentRuleGroup) {
      return Promise.resolve();
    }

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

    return updateOrDeleteFunction()
      .catch(setError)
      .finally(() => {
        setSuccess(true);
        setLoading(false);
      });
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

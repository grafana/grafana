import { Action } from '@reduxjs/toolkit';
import { useCallback, useState } from 'react';

import { dispatch, getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { deleteRuleAction, pauseRuleAction, ruleGroupReducer } from '../reducers/ruler/ruleGroups';
import {
  fetchPromAndRulerRulesAction,
  fetchRulesSourceBuildInfoAction,
  getDataSourceRulerConfig,
} from '../state/actions';

type ProduceNewRuleGroupOptions = {
  /**
   * Should we dispatch additional actions to ensure that other (non-RTKQ) caches are cleared?
   */
  refetchAllRules?: boolean;
};

// @TODO the manual state tracking here is abysmal but we don't have a better idea that works right now
function useProduceNewRuleGroup() {
  const [fetchRuleGroup] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [updateRuleGroup] = alertRuleApi.endpoints.updateRuleGroupForNamespace.useMutation();
  const [deleteRuleGroup] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useLazyQuery();

  const [isUninitialized, setIsUninitialized] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<unknown | undefined>();

  const aggregateState = {
    isUninitialized,
    isLoading,
    isSuccess,
    isError: Boolean(error),
    error,
  };

  const produceNewRuleGroup = async (
    ruleGroup: RuleGroupIdentifier,
    action: Action,
    options?: ProduceNewRuleGroupOptions
  ) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: dataSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    setIsLoading(true);
    setIsUninitialized(false);

    const currentRuleGroup = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: groupName,
    })
      .unwrap()
      .catch((error) => {
        setError(error);
        setIsSuccess(false);
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

    updateOrDeleteFunction()
      .then((result) => {
        if (options?.refetchAllRules) {
          // refetch rules for this rules source
          // @TODO remove this when we moved everything to RTKQ – then the endpoint will simply invalidate the tags
          dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: ruleGroup.dataSourceName }));
        }

        return result;
      })
      .catch((error) => {
        setError(error);
      })
      .finally(() => {
        setIsSuccess(true);
        setIsLoading(false);
      });
  };

  return [produceNewRuleGroup, aggregateState] as const;
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

      return produceNewRuleGroup(ruleGroup, action, { refetchAllRules: true });
    },
    [produceNewRuleGroup]
  );

  return [deleteFn, produceNewRuleGroupState] as const;
}

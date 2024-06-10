import { Action } from '@reduxjs/toolkit';
import { useCallback } from 'react';

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

import { mergeRequestStates } from './mergeRequestStates';

type ProduceNewRuleGroupOptions = {
  /**
   * Should we dispatch additional actions to ensure that other (non-RTKQ) caches are cleared?
   */
  refetchAllRules?: boolean;
};

function useProduceNewRuleGroup() {
  const [fetchRuleGroup, fetchRuleGroupState] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [deleteRuleGroup, deleteRuleGroupState] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useLazyQuery();
  const [updateRuleGroup, updateRuleGroupState] = alertRuleApi.endpoints.updateRuleGroupForNamespace.useMutation();

  const produceNewRuleGroup = async (
    ruleGroup: RuleGroupIdentifier,
    action: Action,
    options?: ProduceNewRuleGroupOptions
  ) => {
    const { dataSourceName, groupName, namespaceName } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: dataSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, dataSourceName);

    const currentRuleGroup = await fetchRuleGroup({
      rulerConfig,
      namespace: namespaceName,
      group: groupName,
    }).unwrap();

    // @TODO convert rule group to postable rule group – TypeScript is not complaining here because
    // the interfaces are compatible but it _should_ complain
    const newRuleGroup = ruleGroupReducer(currentRuleGroup, action);

    const deleteEntireGroup = newRuleGroup.rules.length === 0;

    // if we have no more rules in the group, we delete the entire group, otherwise just update the rule group
    const updateOrDelete = () => {
      if (deleteEntireGroup) {
        return [
          deleteRuleGroup({
            rulerConfig,
            namespace: namespaceName,
            group: groupName,
          }).unwrap(),
          mergeRequestStates(fetchRuleGroupState, deleteRuleGroupState),
        ] as const;
      }

      return [
        updateRuleGroup({
          rulerConfig,
          namespace: namespaceName,
          payload: newRuleGroup,
        }).unwrap(),
        mergeRequestStates(fetchRuleGroupState, updateRuleGroupState),
      ] as const;
    };

    const [updateOrDeleteResult, state] = updateOrDelete();

    if (options?.refetchAllRules) {
      // refetch rules for this rules source
      // @TODO remove this when we moved everything to RTKQ – then the endpoint will simply invalidate the tags
      dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: ruleGroup.dataSourceName }));
    }

    return [updateOrDeleteResult, state];
  };

  // @TODO merge loading state with the fetching state
  return [produceNewRuleGroup, updateRuleGroupState] as const;
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

import { Action } from '@reduxjs/toolkit';
import { useCallback } from 'react';

import { getState } from 'app/store/store';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, RulerGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { addRuleAction, deleteRuleAction, pauseRuleAction, ruleGroupReducer } from '../reducers/ruler/ruleGroups';
import { getDataSourceRulerConfig } from '../state/actions';

export function useProduceNewRuleGroup() {
  const [fetchRuleGroup, _fetchRuleGroupState] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [deleteRuleGroup, _deleteRuleGroupState] = alertRuleApi.endpoints.deleteRuleGroupFromNamespace.useLazyQuery();
  const [updateRuleGroup, updateRuleGroupState] = alertRuleApi.endpoints.updateRuleGroupForNamespace.useMutation();

  const produceNewRuleGroup = async (ruleGroup: RuleGroupIdentifier, action: Action) => {
    const { ruleSourceName, group, namespace } = ruleGroup;

    // @TODO we should really not work with the redux state (getState) here
    const rulerConfig = getDataSourceRulerConfig(getState, ruleSourceName);
    const currentRuleGroup = await fetchRuleGroup({ rulerConfig, namespace, group }).unwrap();

    // @TODO convert rule group to postable rule group – TypeScript is not complaining here because
    // the interfaces are compatible but it _should_ complain
    const newRuleGroup = ruleGroupReducer(currentRuleGroup, action);

    // if this was the last rule in the group after applying the action on the reducer we remove the group in its entirety
    const deleteEntireGroup = newRuleGroup.rules.length === 0;
    if (deleteEntireGroup) {
      return deleteRuleGroup({
        rulerConfig,
        namespace,
        group,
      });
    }

    // otherwise assume we just want to update the existing group
    return updateRuleGroup({
      rulerConfig,
      namespace,
      payload: newRuleGroup,
    }).unwrap();
  };

  // @TODO merge loading state with the fetching state
  return [produceNewRuleGroup, updateRuleGroupState] as const;
}

export function usePauseRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, rule: RulerGrafanaRuleDTO, pause: boolean) => {
      const uid = rule.grafana_alert.uid;
      const action = pauseRuleAction({ uid, pause });

      await produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function useAddRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, rule: PostableRuleDTO) => {
      const action = addRuleAction({ rule });
      await produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function useDeleteRuleFromGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  // @TODO make sure we remove the entire group if the rule we want to delete is the last one in the list
  const deleteFn = useCallback(
    async (ruleGroup: RuleGroupIdentifier, rule: RulerRuleDTO) => {
      const action = deleteRuleAction(rule);
      await produceNewRuleGroup(ruleGroup, action);
    },
    [produceNewRuleGroup]
  );

  return [deleteFn, updateState] as const;
}

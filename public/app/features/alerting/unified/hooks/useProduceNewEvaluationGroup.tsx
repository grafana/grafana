import { Action } from '@reduxjs/toolkit';
import { useCallback } from 'react';

import { RuleIdentifier, RulerDataSourceConfig } from 'app/types/unified-alerting';
import { PostableRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import {
  addRuleAction,
  deleteRuleAction,
  pauseRuleAction,
  ruleGroupReducer,
  updateRuleAction,
} from '../reducers/ruler/ruleGroups';

export function useProduceNewRuleGroup() {
  const [fetchRuleGroup, _fetchRuleGroupState] = alertRuleApi.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [updateRuleGroup, updateRuleGroupState] = alertRuleApi.endpoints.updateRuleGroupForNamespace.useMutation();

  const produceNewRuleGroup = async (
    rulerConfig: RulerDataSourceConfig,
    namespace: string,
    group: string,
    action: Action
  ) => {
    const currentRuleGroup = await fetchRuleGroup({ rulerConfig, namespace, group }).unwrap();

    // @TODO convert rule group to postable rule group – TypeScript is not complaining here because
    // the interfaces are compatible but it _should_ complain
    const newRuleGroup = ruleGroupReducer(currentRuleGroup, action);

    return updateRuleGroup({
      nameSpaceUID: namespace,
      payload: newRuleGroup,
    }).unwrap();
  };

  // @TODO merge loading state with the fetching state
  return [produceNewRuleGroup, updateRuleGroupState] as const;
}

export function useUpdateRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (
      rulerConfig: RulerDataSourceConfig,
      namespace: string,
      group: string,
      identifier: RuleIdentifier,
      rule: PostableRuleDTO
    ) => {
      const action = updateRuleAction({ identifier, rule });
      await produceNewRuleGroup(rulerConfig, namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function usePauseRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (rulerConfig: RulerDataSourceConfig, namespace: string, group: string, uid: string, pause: boolean) => {
      const action = pauseRuleAction({ uid, pause });
      await produceNewRuleGroup(rulerConfig, namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function useAddRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (rulerConfig: RulerDataSourceConfig, namespace: string, group: string, rule: PostableRuleDTO) => {
      const action = addRuleAction({ rule });
      await produceNewRuleGroup(rulerConfig, namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function useDeleteRuleFromGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const deleteFn = useCallback(
    async (rulerConfig: RulerDataSourceConfig, namespace: string, group: string, identifier: RuleIdentifier) => {
      const action = deleteRuleAction({ identifier });
      await produceNewRuleGroup(rulerConfig, namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [deleteFn, updateState] as const;
}

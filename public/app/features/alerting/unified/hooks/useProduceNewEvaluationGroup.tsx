import { Action } from '@reduxjs/toolkit';
import { useCallback } from 'react';

import { RuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, PostableRulerRuleGroupDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from '../api/alertingApi';
import { addRuleAction, deleteRuleAction, ruleGroupReducer, updateRuleAction } from '../reducers/ruler/ruleGroups';

export function useProduceNewRuleGroup() {
  const [fetchRuleGroup, _fetchRuleGroupState] = rulerAPI.endpoints.getRuleGroupForNamespace.useLazyQuery();
  const [updateRuleGroup, updateRuleGroupState] = rulerAPI.endpoints.updateRuleGroupForNamespace.useMutation();

  const produceNewRuleGroup = async (namespace: string, group: string, action: Action) => {
    const currentRuleGroup = await fetchRuleGroup({ namespace, group }).unwrap();

    // @TODO convert rule group to postable rule group – TypeScript is not complaining here because
    // the interfaces are compatible but it _should_ complain
    const newRuleGroup = ruleGroupReducer(currentRuleGroup, action);

    return updateRuleGroup({
      namespace,
      group,
      data: newRuleGroup,
    }).unwrap();
  };

  // @TODO merge loading state with the fetching state
  return [produceNewRuleGroup, updateRuleGroupState] as const;
}

export function useUpdateRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (namespace: string, group: string, identifier: RuleIdentifier, rule: PostableRuleDTO) => {
      const action = updateRuleAction({ identifier, rule });
      await produceNewRuleGroup(namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function useAddRuleInGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const updateFn = useCallback(
    async (namespace: string, group: string, rule: PostableRuleDTO) => {
      const action = addRuleAction({ rule });
      await produceNewRuleGroup(namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [updateFn, updateState] as const;
}

export function useDeleteRuleFromGroup() {
  const [produceNewRuleGroup, updateState] = useProduceNewRuleGroup();

  const deleteFn = useCallback(
    async (namespace: string, group: string, identifier: RuleIdentifier) => {
      const action = deleteRuleAction({ identifier });
      await produceNewRuleGroup(namespace, group, action);
    },
    [produceNewRuleGroup]
  );

  return [deleteFn, updateState] as const;
}

// do NOT use these directly, use the higher-level hooks
const rulerAPI = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getRuleGroupForNamespace: build.query<RulerRuleGroupDTO, { namespace: string; group: string }>({
      queryFn: ({ namespace, group }) => {},
    }),
    updateRuleGroupForNamespace: build.mutation<
      void,
      { namespace: string; group: string; data: PostableRulerRuleGroupDTO }
    >({
      queryFn: ({ namespace, group, data }) => {},
    }),
  }),
});

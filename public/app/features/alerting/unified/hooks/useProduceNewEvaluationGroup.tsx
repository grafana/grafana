import { Draft, Immutable, WritableDraft, castImmutable, produce } from 'immer';
import { omit } from 'lodash';
import { useCallback, useMemo } from 'react';

import { PostableRuleDTO, PostableRulerRuleGroupDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertingApi } from '../api/alertingApi';

// available actions for rule groups
type AddAction = { type: 'add'; payload: PostableRuleDTO };
type RemoveAction = { type: 'remove'; index: number };

type Action = AddAction | RemoveAction;

const ruleGroupReducer = produce<RulerRuleGroupDTO, [Action]>((draft, action) => {
  switch (action.type) {
    case 'add':
      return draft;
    case 'remove':
      return draft;
    default:
      return draft;
  }
});

export function useProduceNewRuleGroup() {
  const [fetchRuleGroup, _fetchRuleGroupState] = rulerAPI.endpoints.getNamespaceAndGroup.useLazyQuery();
  const [updateRuleGroup, updateRuleGroupState] = rulerAPI.endpoints.updateRuleGroup.useMutation();

  const produceNewRuleGroup = async (namespace: string, group: string, action: Action) => {
    const currentRuleGroup = await fetchRuleGroup({ namespace, group }).unwrap();

    const newRuleGroup = ruleGroupReducer(currentRuleGroup, action);

    // @TODO move this to an RTKQ endpoint
    return updateRuleGroup({
      namespace,
      group,
      data: newRuleGroup,
    }).unwrap();
  };

  // @TODO merge loading state with the fetching state
  return [produceNewRuleGroup, updateRuleGroupState] as const;
}

// this function omits a few props from RulerRuleGroupDTO so we can use it to send POST requests without having them be rejected
function toPostableDTO(ruleGroup: WritableDraft<RulerRuleGroupDTO>): PostableRulerRuleGroupDTO {
  return ruleGroup;
}

export function useAddRuleToRuleGroup() {
  const [produceNewRuleGroup, updateRuleGroupState] = useProduceNewRuleGroup();

  const updateFn = (namespace: string, group: string, rule: PostableRuleDTO) =>
    produceNewRuleGroup(namespace, group, { type: 'add', payload: rule });

  return [updateFn, updateRuleGroupState];
}

// here's how to consume this hook
//
// const [addRuleToRuleGroup, { isLoading, error }] = useAddRuleToRuleGroup();
// addRuleToRuleGroup(namespace, group, myNewRule);

// do NOT use these directly, use the higher-level hooks
const rulerAPI = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getNamespaceAndGroup: build.query<RulerRuleGroupDTO, { namespace: string; group: string }>({
      queryFn: ({ namespace, group }) => {},
    }),
    updateRuleGroup: build.mutation<void, { namespace: string; group: string; data: PostableRulerRuleGroupDTO }>({
      queryFn: ({ namespace, group, data }) => {},
    }),
  }),
});

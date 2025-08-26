import { createAction, createReducer, isAnyOf } from '@reduxjs/toolkit';
import { inRange } from 'lodash';

import { EditableRuleIdentifier, GrafanaRuleIdentifier, RuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { hashRulerRule } from '../../utils/rule-id';
import { isCloudRuleIdentifier, isGrafanaRuleIdentifier, rulerRuleType } from '../../utils/rules';

// rule-scoped actions
// TOOD The interval field only make sense when adding a rule to a new rule group.
// We need to split these into distinct actions and introduce a separete addNewRuleGroupAction.
export const addRuleAction = createAction<{ rule: PostableRuleDTO; groupName?: string; interval?: string }>(
  'ruleGroup/rules/add'
);
export const updateRuleAction = createAction<{ identifier: EditableRuleIdentifier; rule: PostableRuleDTO }>(
  'ruleGroup/rules/update'
);
export const pauseRuleAction = createAction<{ uid: string; pause: boolean }>('ruleGroup/rules/pause');
export const deleteRuleAction = createAction<{ identifier: EditableRuleIdentifier }>('ruleGroup/rules/delete');

// group-scoped actions
export const updateRuleGroupAction = createAction<{ interval?: string }>('ruleGroup/update');
export const moveRuleGroupAction = createAction<{ newNamespaceName: string; groupName?: string; interval?: string }>(
  'ruleGroup/move'
);
export const renameRuleGroupAction = createAction<{ groupName: string; interval?: string }>('ruleGroup/rename');
export const reorderRulesInRuleGroupAction = createAction<{ swaps: SwapOperation[] }>('ruleGroup/rules/reorder');

const initialState: PostableRulerRuleGroupDTO = {
  name: 'initial',
  rules: [],
};

export const ruleGroupReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(addRuleAction, (draft, { payload }) => {
      const { rule } = payload;
      draft.rules.push(rule);
    })
    .addCase(updateRuleAction, (draft, { payload }) => {
      const { identifier, rule } = payload;

      const index = findRuleIndex(draft.rules, identifier);
      draft.rules[index] = rule;
    })
    .addCase(deleteRuleAction, (draft, { payload }) => {
      const { identifier } = payload;

      const index = findRuleIndex(draft.rules, identifier);
      draft.rules.splice(index, 1);
    })
    .addCase(pauseRuleAction, (draft, { payload }) => {
      const { uid, pause } = payload;

      const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };
      const index = findRuleIndex(draft.rules, identifier);
      const matchingRule = draft.rules[index];

      if (rulerRuleType.grafana.rule(matchingRule)) {
        matchingRule.grafana_alert.is_paused = pause;
      } else {
        throw new Error('Matching rule is not a Grafana-managed rule');
      }
    })
    .addCase(reorderRulesInRuleGroupAction, (draft, { payload }) => {
      const { swaps } = payload;
      reorder(draft.rules, swaps);
    })
    // rename and move should allow updating the group's name
    .addMatcher(isAnyOf(renameRuleGroupAction, moveRuleGroupAction, addRuleAction), (draft, { payload }) => {
      const { groupName } = payload;
      draft.name = groupName ?? draft.name;
    })
    // update, rename and move should all allow updating the interval of the group
    .addMatcher(
      isAnyOf(updateRuleGroupAction, renameRuleGroupAction, moveRuleGroupAction, addRuleAction),
      (draft, { payload }) => {
        const { interval } = payload;
        draft.interval = interval ?? draft.interval;
      }
    )
    .addDefaultCase((_draft, action) => {
      throw new Error(`Unknown action for rule group reducer: ${action.type}`);
    });
});

/**
 * Utility function for finding rules matching a identifier, pass this into .find, .findIndex, .remove
 * or any other function with matching predicate.
 */
const ruleFinder = (identifier: RuleIdentifier) => {
  const grafanaManagedIdentifier = isGrafanaRuleIdentifier(identifier);
  const dataSourceManagedIdentifier = isCloudRuleIdentifier(identifier);

  return (rule: PostableRuleDTO) => {
    const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);
    const isDataSourceManagedRule = rulerRuleType.dataSource.rule(rule);

    if (grafanaManagedIdentifier && isGrafanaManagedRule) {
      return rule.grafana_alert.uid === identifier.uid;
    }

    if (isDataSourceManagedRule && dataSourceManagedIdentifier) {
      return hashRulerRule(rule) === identifier.rulerRuleHash;
    }

    return;
  };
};

// [oldIndex, newIndex]
export type SwapOperation = [number, number];

/**
 * ⚠️ This function mutates the input array
 * reorder several items in a list, given a set of swap
 */
export function reorder<T>(items: T[], swaps: Array<[number, number]>) {
  for (const swap of swaps) {
    swapItems(items, swap);
  }
  return items;
}

/**
 * ⚠️ This function mutates the input array
 * swaps two items in an array of items
 */
export function swapItems<T>(items: T[], [oldIndex, newIndex]: SwapOperation): void {
  const inBounds = inRange(oldIndex, items.length) && inRange(newIndex, items.length);
  if (!inBounds) {
    throw new Error('Invalid operation: index out of bounds');
  }

  const [movedItem] = items.splice(oldIndex, 1);
  items.splice(newIndex, 0, movedItem);
}

function findRuleIndex(rules: PostableRuleDTO[], identifier: EditableRuleIdentifier) {
  const index = rules.findIndex(ruleFinder(identifier));
  if (index === -1) {
    throw new Error('no rule matching identifier found');
  }

  return index;
}

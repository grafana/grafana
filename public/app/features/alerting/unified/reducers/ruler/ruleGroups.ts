import { createAction, createReducer, isAnyOf } from '@reduxjs/toolkit';
import { inRange, remove } from 'lodash';

import { EditableRuleIdentifier, GrafanaRuleIdentifier, RuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { hashRulerRule } from '../../utils/rule-id';
import {
  isCloudRuleIdentifier,
  isCloudRulerRule,
  isGrafanaRuleIdentifier,
  isGrafanaRulerRule,
} from '../../utils/rules';

// rule-scoped actions
export const addRuleAction = createAction<{ rule: PostableRuleDTO }>('ruleGroup/rules/add');
export const updateRuleAction = createAction<{ identifier: EditableRuleIdentifier; rule: PostableRuleDTO }>(
  'ruleGroup/rules/update'
);
export const pauseRuleAction = createAction<{ uid: string; pause: boolean }>('ruleGroup/rules/pause');
export const deleteRuleAction = createAction<{ identifier: EditableRuleIdentifier }>('ruleGroup/rules/delete');

// group-scoped actions
export const updateRuleGroupAction = createAction<{ interval?: string }>('ruleGroup/update');
export const moveRuleGroupAction = createAction<{ namespaceName: string; groupName?: string; interval?: string }>(
  'ruleGroup/move'
);
export const renameRuleGroupAction = createAction<{ groupName: string; interval?: string }>('ruleGroup/rename');
export const reorderRulesInRuleGroupAction = createAction<{ operations: SwapOperation[] }>('ruleGroup/rules/reorder');

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

      const ruleIndex = draft.rules.findIndex(ruleFinder(identifier));
      draft.rules[ruleIndex] = rule;
    })
    .addCase(deleteRuleAction, (draft, { payload }) => {
      const { identifier } = payload;

      remove(draft.rules, ruleFinder(identifier));
    })
    .addCase(pauseRuleAction, (draft, { payload }) => {
      const { uid, pause } = payload;

      const identifier: GrafanaRuleIdentifier = { ruleSourceName: GRAFANA_RULES_SOURCE_NAME, uid };
      const ruleIndex = draft.rules.findIndex(ruleFinder(identifier));
      if (notFound(ruleIndex)) {
        throw new Error(`No rule with UID ${uid} found`);
      }

      const matchingRule = draft.rules[ruleIndex];

      if (isGrafanaRulerRule(matchingRule)) {
        matchingRule.grafana_alert.is_paused = pause;
      } else {
        throw new Error('Matching rule is not a Grafana-managed rule');
      }
    })
    .addCase(reorderRulesInRuleGroupAction, (draft, { payload }) => {
      const { operations } = payload;
      reorder(draft.rules, operations);
    })
    // rename and move should allow updating the group's name
    .addMatcher(isAnyOf(renameRuleGroupAction, moveRuleGroupAction), (draft, { payload }) => {
      const { groupName } = payload;
      if (groupName) {
        draft.name = groupName;
      }
    })
    // update, rename and move should all allow updating the interval of the group
    .addMatcher(isAnyOf(updateRuleGroupAction, renameRuleGroupAction, moveRuleGroupAction), (draft, { payload }) => {
      const { interval } = payload;
      if (interval) {
        draft.interval = interval;
      }
    })
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
    const isGrafanaManagedRule = isGrafanaRulerRule(rule);
    const isDataSourceManagedRule = isCloudRulerRule(rule);

    if (grafanaManagedIdentifier && isGrafanaManagedRule) {
      return rule.grafana_alert.uid === identifier.uid;
    }

    if (isDataSourceManagedRule && dataSourceManagedIdentifier) {
      return hashRulerRule(rule) === identifier.rulerRuleHash;
    }

    // @TODO more error info
    throw new Error('No such rule with identifier found in group');
  };
};

// [oldIndex, newIndex]
export type SwapOperation = [number, number];

export function reorder<T>(items: T[], operations: Array<[number, number]>) {
  for (let operation of operations) {
    swap(items, operation);
  }
  return items;
}

export function swap<T>(items: T[], [oldIndex, newIndex]: SwapOperation) {
  const inBounds = inRange(oldIndex, items.length) && inRange(newIndex, items.length);
  if (!inBounds) {
    throw new Error('Invalid operation: index out of bounds');
  }

  const [movedItem] = items.splice(oldIndex, 1);
  items.splice(newIndex, 0, movedItem);

  return items;
}

function notFound(index: number) {
  return index === -1;
}

import { createAction, createReducer, isAnyOf } from '@reduxjs/toolkit';
import { remove } from 'lodash';

import { EditableRuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

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
export const reorderRulesInRuleGroupAction = createAction('ruleGroup/rules/reorder');

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

      const grafanaManagedIdentifier = isGrafanaRuleIdentifier(identifier);
      const dataSourceManagedIdentifier = isCloudRuleIdentifier(identifier);

      const ruleIndex = draft.rules.findIndex((rule) => {
        const isGrafanaManagedRule = isGrafanaRulerRule(rule);
        const isDataSourceManagedRule = isCloudRulerRule(rule);

        if (grafanaManagedIdentifier && isGrafanaManagedRule) {
          return rule.grafana_alert.uid === identifier.uid;
        }

        if (isDataSourceManagedRule && dataSourceManagedIdentifier) {
          return hashRulerRule(rule) === identifier.rulerRuleHash;
        }

        return;
      });

      if (ruleIndex === -1) {
        // @TODO add error details
        throw new Error('No such rule with identifier found in group');
      }

      draft.rules[ruleIndex] = rule;
    })
    .addCase(deleteRuleAction, (draft, { payload }) => {
      const { identifier } = payload;

      const grafanaManagedIdentifier = isGrafanaRuleIdentifier(identifier);
      const dataSourceManagedIdentifier = isCloudRuleIdentifier(identifier);

      remove(draft.rules, (rule) => {
        const isGrafanaManagedRule = isGrafanaRulerRule(rule);
        const isDataSourceManagedRule = isCloudRulerRule(rule);

        if (grafanaManagedIdentifier && isGrafanaManagedRule) {
          return rule.grafana_alert.uid === identifier.uid;
        } else if (isDataSourceManagedRule && dataSourceManagedIdentifier) {
          return hashRulerRule(rule) === identifier.rulerRuleHash;
        }

        throw new Error('No such rule with identifier found in group');
      });
    })
    .addCase(pauseRuleAction, (draft, { payload }) => {
      const { uid, pause } = payload;

      let match = false;

      for (const rule of draft.rules) {
        if (isGrafanaRulerRule(rule) && rule.grafana_alert.uid === uid) {
          match = true;
          rule.grafana_alert.is_paused = pause;
          break;
        }
      }

      if (!match) {
        throw new Error(`No rule with UID ${uid} found in group ${draft.name}`);
      }
    })
    .addCase(reorderRulesInRuleGroupAction, () => {
      throw new Error('not yet implemented');
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

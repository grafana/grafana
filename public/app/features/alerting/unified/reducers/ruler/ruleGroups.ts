import { createAction, createReducer, isAnyOf } from '@reduxjs/toolkit';
import { remove } from 'lodash';

import { RuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, PostableRulerRuleGroupDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { hashRulerRule } from '../../utils/rule-id';
import { isCloudRulerRule, isGrafanaRulerRule } from '../../utils/rules';

// rule-scoped actions
export const addRuleAction = createAction<{ rule: PostableRuleDTO }>('ruleGroup/rules/add');
export const updateRuleAction = createAction<{ identifier: RuleIdentifier; rule: PostableRuleDTO }>(
  'ruleGroup/rules/update'
);
export const pauseRuleAction = createAction<{ uid: string; pause: boolean }>('ruleGroup/rules/pause');
export const deleteRuleAction = createAction<{ rule: RulerRuleDTO }>('ruleGroup/rules/delete');

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
    .addCase(addRuleAction, () => {
      throw new Error('not yet implemented');
    })
    .addCase(updateRuleAction, () => {
      throw new Error('not yet implemented');
    })
    .addCase(deleteRuleAction, (draft, { payload }) => {
      const { rule } = payload;

      // deleting a Grafana managed rule is by using the UID
      if (isGrafanaRulerRule(rule)) {
        const ruleUID = rule.grafana_alert.uid;
        remove(draft.rules, (rule) => isGrafanaRulerRule(rule) && rule.grafana_alert.uid === ruleUID);
      }

      // deleting a Data-source managed rule is by computing the rule hash
      if (isCloudRulerRule(rule)) {
        const ruleHash = hashRulerRule(rule);
        remove(draft.rules, (rule) => isCloudRulerRule(rule) && hashRulerRule(rule) === ruleHash);
      }
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

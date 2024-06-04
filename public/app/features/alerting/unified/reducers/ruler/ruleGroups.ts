import { createAction, createReducer } from '@reduxjs/toolkit';
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
export const deleteRuleAction = createAction<RulerRuleDTO>('ruleGroup/rules/delete');

// group-scoped actions
const reorderRulesActions = createAction('ruleGroup/rules/reorder');
const updateGroup = createAction('ruleGroup/update');

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
    .addCase(deleteRuleAction, (draft, { payload: rule }) => {
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

      draft.rules.forEach((rule) => {
        if (isGrafanaRulerRule(rule) && rule.grafana_alert.uid === uid) {
          rule.grafana_alert.is_paused = pause;
        }
      });
    })
    .addCase(reorderRulesActions, () => {
      throw new Error('not yet implemented');
    })
    .addCase(updateGroup, () => {
      throw new Error('not yet implemented');
    })
    .addDefaultCase((_draft, action) => {
      throw new Error(`Unknown action for rule group reducer: ${action.type}`);
    });
});

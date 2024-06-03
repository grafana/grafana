import { createAction, createReducer } from '@reduxjs/toolkit';

import { RuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, PostableRulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { isGrafanaRulerRule } from '../../utils/rules';

export const addRuleAction = createAction<{ rule: PostableRuleDTO }>('ruleGroup/add');
export const updateRuleAction = createAction<{ identifier: RuleIdentifier; rule: PostableRuleDTO }>('ruleGroup/update');
export const pauseRuleAction = createAction<{ uid: string; pause: boolean }>('ruleGroup/pause');
export const deleteRuleAction = createAction<{ identifier: RuleIdentifier }>('ruleGroup/delete');
// @TODO
// const reorderRulesActions = createAction('rules/reorder');

const initialState: PostableRulerRuleGroupDTO = {
  name: 'initial',
  rules: [],
};

export const ruleGroupReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(addRuleAction, (draft, { payload }) => {
      const { rule } = payload;
    })
    .addCase(updateRuleAction, (draft, { payload }) => {
      const { identifier, rule } = payload;
    })
    .addCase(deleteRuleAction, (draft, { payload }) => {
      const { identifier } = payload;
    })
    .addCase(pauseRuleAction, (draft, { payload }) => {
      const { uid, pause } = payload;

      draft.rules.forEach((rule) => {
        if (isGrafanaRulerRule(rule) && rule.grafana_alert.uid === uid) {
          rule.grafana_alert.is_paused = pause;
        }
      });
    })
    .addDefaultCase((_draft, action) => {
      throw new Error(`Unknown action for rule group reducer: ${action.type}`);
    });
});

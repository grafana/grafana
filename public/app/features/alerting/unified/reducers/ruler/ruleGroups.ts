import { createAction, createReducer } from '@reduxjs/toolkit';

import { RuleIdentifier } from 'app/types/unified-alerting';
import { PostableRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

export const addRuleAction = createAction<{ rule: PostableRuleDTO }>('rules/add');
export const updateRuleAction = createAction<{ identifier: RuleIdentifier; rule: PostableRuleDTO }>('rules/update');
export const deleteRuleAction = createAction<{ identifier: RuleIdentifier }>('rules/delete');
// @TODO
// const reorderRulesActions = createAction('rules/reorder');

const initialState: RulerRuleGroupDTO = {
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
    .addDefaultCase((_draft, action) => {
      throw new Error(`Unknown action for rule group reducer: ${action.type}`);
    });
});

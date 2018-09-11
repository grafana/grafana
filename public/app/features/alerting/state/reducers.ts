import moment from 'moment';
import { AlertRuleDTO, AlertRule, AlertRulesState } from 'app/types';
import { Action, ActionTypes } from './actions';
import alertDef from './alertDef';

export const initialState: AlertRulesState = { items: [], searchQuery: '' };

function convertToAlertRule(rule, state): AlertRule {
  const stateModel = alertDef.getStateDisplayModel(state);
  rule.stateText = stateModel.text;
  rule.stateIcon = stateModel.iconClass;
  rule.stateClass = stateModel.stateClass;
  rule.stateAge = moment(rule.newStateDate)
    .fromNow()
    .replace(' ago', '');

  if (rule.state !== 'paused') {
    if (rule.executionError) {
      rule.info = 'Execution Error: ' + rule.executionError;
    }
    if (rule.evalData && rule.evalData.noData) {
      rule.info = 'Query returned no data';
    }
  }

  return rule;
}

export const alertRulesReducer = (state = initialState, action: Action): AlertRulesState => {
  switch (action.type) {
    case ActionTypes.LoadAlertRules: {
      const alertRules: AlertRuleDTO[] = action.payload;

      const alertRulesViewModel: AlertRule[] = alertRules.map(rule => {
        return convertToAlertRule(rule, rule.state);
      });

      return { items: alertRulesViewModel, searchQuery: state.searchQuery };
    }

    case ActionTypes.SetSearchQuery:
      return { items: state.items, searchQuery: action.payload };
  }

  return state;
};

export default {
  alertRules: alertRulesReducer,
};

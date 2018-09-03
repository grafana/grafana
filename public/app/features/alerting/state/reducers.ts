import moment from 'moment';
import { AlertRulesState } from 'app/types';
import { Action, ActionTypes } from './actions';
import alertDef from './alertDef';

export const initialState: AlertRulesState = { items: [], searchQuery: '' };

export function setStateFields(rule, state) {
  const stateModel = alertDef.getStateDisplayModel(state);
  rule.state = state;
  rule.stateText = stateModel.text;
  rule.stateIcon = stateModel.iconClass;
  rule.stateClass = stateModel.stateClass;
  rule.stateAge = moment(rule.newStateDate)
    .fromNow()
    .replace(' ago', '');
}

export const alertRulesReducer = (state = initialState, action: Action): AlertRulesState => {
  switch (action.type) {
    case ActionTypes.LoadAlertRules: {
      const alertRules = action.payload;

      for (const rule of alertRules) {
        setStateFields(rule, rule.state);

        if (rule.state !== 'paused') {
          if (rule.executionError) {
            rule.info = 'Execution Error: ' + rule.executionError;
          }
          if (rule.evalData && rule.evalData.noData) {
            rule.info = 'Query returned no data';
          }
        }
      }

      return { items: alertRules, searchQuery: state.searchQuery };
    }

    case ActionTypes.SetSearchQuery:
      return { items: state.items, searchQuery: action.payload };
  }

  return state;
};

export default {
  alertRules: alertRulesReducer,
};

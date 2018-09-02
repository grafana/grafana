import { Action } from './actions';
import { AlertRule } from 'app/types';
import alertDef from './alertDef';
import moment from 'moment';

export const initialState: AlertRule[] = [];

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

export const alertRulesReducer = (state = initialState, action: Action): AlertRule[] => {
  switch (action.type) {
    case 'LOAD_ALERT_RULES': {
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

      return alertRules;
    }
  }

  return state;
};

export default {
  alertRules: alertRulesReducer,
};

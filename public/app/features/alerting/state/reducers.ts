import { AlertRuleDTO, AlertRule, AlertRulesState } from 'app/types';
import { Action, ActionTypes } from './actions';
import alertDef from './alertDef';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

export const initialState: AlertRulesState = { items: [], searchQuery: '', isLoading: false };

function convertToAlertRule(dto: AlertRuleDTO, state: string): AlertRule {
  const stateModel = alertDef.getStateDisplayModel(state);

  const rule: AlertRule = {
    ...dto,
    stateText: stateModel.text,
    stateIcon: stateModel.iconClass,
    stateClass: stateModel.stateClass,
    stateAge: dateTime(dto.newStateDate).fromNow(true),
  };

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
      return { ...state, isLoading: true };
    }

    case ActionTypes.LoadedAlertRules: {
      const alertRules: AlertRuleDTO[] = action.payload;

      const alertRulesViewModel: AlertRule[] = alertRules.map(rule => {
        return convertToAlertRule(rule, rule.state);
      });

      return { ...state, items: alertRulesViewModel, isLoading: false };
    }

    case ActionTypes.SetSearchQuery:
      return { ...state, searchQuery: action.payload };
  }

  return state;
};

export default {
  alertRules: alertRulesReducer,
};

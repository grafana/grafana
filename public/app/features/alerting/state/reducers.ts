import { AlertRule, AlertRuleDTO, AlertRulesState, NotificationChannel } from 'app/types';
import alertDef from './alertDef';
import { dateTime } from '@grafana/data';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const initialState: AlertRulesState = { items: [], searchQuery: '', isLoading: false, notificationChannels: [] };

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

const alertRulesSlice = createSlice({
  name: 'alertRules',
  initialState,
  reducers: {
    loadAlertRules: state => {
      return { ...state, isLoading: true };
    },
    loadedAlertRules: (state, action: PayloadAction<AlertRuleDTO[]>): AlertRulesState => {
      const alertRules: AlertRuleDTO[] = action.payload;

      const alertRulesViewModel: AlertRule[] = alertRules.map(rule => {
        return convertToAlertRule(rule, rule.state);
      });

      return { ...state, items: alertRulesViewModel, isLoading: false };
    },
    setSearchQuery: (state, action: PayloadAction<string>): AlertRulesState => {
      return { ...state, searchQuery: action.payload };
    },
    setNotificationChannels: (state, action: PayloadAction<NotificationChannel[]>): AlertRulesState => {
      return { ...state, notificationChannels: action.payload };
    },
  },
});

export const { loadAlertRules, loadedAlertRules, setSearchQuery, setNotificationChannels } = alertRulesSlice.actions;

export const alertRulesReducer = alertRulesSlice.reducer;

export default {
  alertRules: alertRulesReducer,
};

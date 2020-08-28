import {
  AlertRule,
  AlertRuleDTO,
  AlertRulesState,
  NotificationChannelOption,
  NotificationChannelState,
  NotifierDTO,
} from 'app/types';
import alertDef from './alertDef';
import { dateTime } from '@grafana/data';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const initialState: AlertRulesState = {
  items: [],
  searchQuery: '',
  isLoading: false,
};

export const initialChannelState: NotificationChannelState = {
  notificationChannelTypes: [],
  notificationChannel: {},
};

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
  },
});

const notificationChannelSlice = createSlice({
  name: 'notificationChannel',
  initialState: initialChannelState,
  reducers: {
    setNotificationChannels: (state, action: PayloadAction<NotifierDTO[]>): NotificationChannelState => {
      return { ...state, notificationChannelTypes: action.payload };
    },
    notificationChannelLoaded: (state, action: PayloadAction<any>): NotificationChannelState => {
      const selectedType: NotifierDTO = state.notificationChannelTypes.filter(t => t.name === action.payload.type);
      const secureFields = selectedType.options.filter((o: NotificationChannelOption) => o.secure);

      if (secureFields.length > 0) {
      }

      return { ...state, notificationChannel: action.payload };
    },
    resetSecureField: (state, action: PayloadAction<string>): NotificationChannelState => {
      return {
        ...state,
        notificationChannel: {
          ...state.notificationChannel,
          secureFields: { ...state.notificationChannel.secureFields, [action.payload]: false },
        },
      };
    },
  },
});

export const { loadAlertRules, loadedAlertRules, setSearchQuery } = alertRulesSlice.actions;

export const {
  setNotificationChannels,
  notificationChannelLoaded,
  resetSecureField,
} = notificationChannelSlice.actions;

export const alertRulesReducer = alertRulesSlice.reducer;
export const notificationChannelReducer = notificationChannelSlice.reducer;

export default {
  alertRules: alertRulesReducer,
  notificationChannel: notificationChannelReducer,
};

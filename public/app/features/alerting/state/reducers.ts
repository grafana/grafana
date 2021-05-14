import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DataFrame, dateTime } from '@grafana/data';
import alertDef from './alertDef';
import {
  AlertDefinition,
  AlertDefinitionDTO,
  AlertDefinitionState,
  AlertDefinitionUiState,
  AlertRule,
  AlertRuleDTO,
  AlertRulesState,
  NotificationChannelOption,
  NotificationChannelState,
  NotifierDTO,
} from 'app/types';
import store from 'app/core/store';
import unifiedAlertingReducer from '../unified/state/reducers';

export const ALERT_DEFINITION_UI_STATE_STORAGE_KEY = 'grafana.alerting.alertDefinition.ui';
const DEFAULT_ALERT_DEFINITION_UI_STATE: AlertDefinitionUiState = { rightPaneSize: 400, topPaneSize: 0.45 };

export const initialState: AlertRulesState = {
  items: [],
  searchQuery: '',
  isLoading: false,
};

export const initialChannelState: NotificationChannelState = {
  notificationChannelTypes: [],
  notificationChannel: {},
  notifiers: [],
};

export const initialAlertDefinitionState: AlertDefinitionState = {
  alertDefinition: {
    id: 0,
    uid: '',
    title: '',
    description: '',
    condition: '',
    data: [],
    intervalSeconds: 60,
  },
  uiState: { ...store.getObject(ALERT_DEFINITION_UI_STATE_STORAGE_KEY, DEFAULT_ALERT_DEFINITION_UI_STATE) },
  data: [],
  alertDefinitions: [] as AlertDefinition[],
  /* These are functions as they are mutated later on and redux toolkit will Object.freeze state so
   * we need to store these using functions instead */
  getInstances: () => [] as DataFrame[],
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
    loadAlertRules: (state) => {
      return { ...state, isLoading: true };
    },
    loadedAlertRules: (state, action: PayloadAction<AlertRuleDTO[]>): AlertRulesState => {
      const alertRules: AlertRuleDTO[] = action.payload;

      const alertRulesViewModel: AlertRule[] = alertRules.map((rule) => {
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
      return {
        ...state,
        notificationChannelTypes: transformNotifiers(action.payload),
        notifiers: action.payload,
      };
    },
    notificationChannelLoaded: (state, action: PayloadAction<any>): NotificationChannelState => {
      const notificationChannel = action.payload;
      const selectedType: NotifierDTO = state.notifiers.find((t) => t.type === notificationChannel.type)!;
      const secureChannelOptions = selectedType.options.filter((o: NotificationChannelOption) => o.secure);
      /*
        If any secure field is in plain text we need to migrate it to use secure field instead.
       */
      if (
        secureChannelOptions.length > 0 &&
        secureChannelOptions.some((o: NotificationChannelOption) => {
          return notificationChannel.settings[o.propertyName] !== '';
        })
      ) {
        return migrateSecureFields(state, action.payload, secureChannelOptions);
      }

      return { ...state, notificationChannel: notificationChannel };
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

const alertDefinitionSlice = createSlice({
  name: 'alertDefinition',
  initialState: initialAlertDefinitionState,
  reducers: {
    setAlertDefinition: (state: AlertDefinitionState, action: PayloadAction<AlertDefinitionDTO>) => {
      state.alertDefinition.title = action.payload.title;
      state.alertDefinition.id = action.payload.id;
      state.alertDefinition.uid = action.payload.uid;
      state.alertDefinition.condition = action.payload.condition;
      state.alertDefinition.intervalSeconds = action.payload.intervalSeconds;
      state.alertDefinition.data = action.payload.data;
      state.alertDefinition.description = action.payload.description;
    },
    updateAlertDefinitionOptions: (state: AlertDefinitionState, action: PayloadAction<Partial<AlertDefinition>>) => {
      state.alertDefinition = { ...state.alertDefinition, ...action.payload };
    },
    setUiState: (state: AlertDefinitionState, action: PayloadAction<AlertDefinitionUiState>) => {
      state.uiState = { ...state.uiState, ...action.payload };
    },
    setAlertDefinitions: (state: AlertDefinitionState, action: PayloadAction<AlertDefinition[]>) => {
      state.alertDefinitions = action.payload;
    },
    setInstanceData: (state: AlertDefinitionState, action: PayloadAction<DataFrame[]>) => {
      state.getInstances = () => action.payload;
    },
    cleanUpState: (state: AlertDefinitionState, action: PayloadAction<undefined>) => {
      state.alertDefinitions = initialAlertDefinitionState.alertDefinitions;
      state.alertDefinition = initialAlertDefinitionState.alertDefinition;
      state.data = initialAlertDefinitionState.data;
      state.getInstances = initialAlertDefinitionState.getInstances;
      state.uiState = initialAlertDefinitionState.uiState;
    },
  },
});

export const { loadAlertRules, loadedAlertRules, setSearchQuery } = alertRulesSlice.actions;

export const {
  setNotificationChannels,
  notificationChannelLoaded,
  resetSecureField,
} = notificationChannelSlice.actions;

export const {
  setUiState,
  updateAlertDefinitionOptions,
  setAlertDefinitions,
  setAlertDefinition,
  setInstanceData,
  cleanUpState,
} = alertDefinitionSlice.actions;

export const alertRulesReducer = alertRulesSlice.reducer;
export const notificationChannelReducer = notificationChannelSlice.reducer;
export const alertDefinitionsReducer = alertDefinitionSlice.reducer;

export default {
  alertRules: alertRulesReducer,
  notificationChannel: notificationChannelReducer,
  alertDefinition: alertDefinitionsReducer,
  unifiedAlerting: unifiedAlertingReducer,
};

function migrateSecureFields(
  state: NotificationChannelState,
  notificationChannel: any,
  secureChannelOptions: NotificationChannelOption[]
) {
  const cleanedSettings: { [key: string]: string } = {};
  const secureSettings: { [key: string]: string } = {};

  secureChannelOptions.forEach((option) => {
    secureSettings[option.propertyName] = notificationChannel.settings[option.propertyName];
    cleanedSettings[option.propertyName] = '';
  });

  return {
    ...state,
    notificationChannel: {
      ...notificationChannel,
      settings: { ...notificationChannel.settings, ...cleanedSettings },
      secureSettings: { ...secureSettings },
    },
  };
}

function transformNotifiers(notifiers: NotifierDTO[]) {
  return notifiers
    .map((option: NotifierDTO) => {
      return {
        value: option.type,
        label: option.name,
        ...option,
        typeName: option.type,
      };
    })
    .sort((o1, o2) => {
      if (o1.name > o2.name) {
        return 1;
      }
      return -1;
    });
}

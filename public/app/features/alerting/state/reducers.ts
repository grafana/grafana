import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ApplyFieldOverrideOptions, DataTransformerConfig, dateTime, FieldColorModeId } from '@grafana/data';
import alertDef from './alertDef';
import {
  AlertCondition,
  AlertDefinition,
  AlertDefinitionState,
  AlertDefinitionUiState,
  AlertRule,
  AlertRuleDTO,
  AlertRulesState,
  NotificationChannelOption,
  NotificationChannelState,
  NotifierDTO,
  QueryGroupOptions,
} from 'app/types';
import store from 'app/core/store';
import { config } from '@grafana/runtime';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';

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

const options: ApplyFieldOverrideOptions = {
  fieldConfig: {
    defaults: {
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
    },
    overrides: [],
  },
  replaceVariables: (v: string) => v,
  theme: config.theme,
};

const dataConfig = {
  getTransformations: () => [] as DataTransformerConfig[],
  getFieldOverrideOptions: () => options,
};

export const initialAlertDefinitionState: AlertDefinitionState = {
  alertDefinition: {
    id: 0,
    title: '',
    description: '',
    condition: {} as AlertCondition,
    interval: 60,
  },
  queryOptions: { maxDataPoints: 100, dataSource: {}, queries: [] },
  queryRunner: new PanelQueryRunner(dataConfig),
  uiState: { ...store.getObject(ALERT_DEFINITION_UI_STATE_STORAGE_KEY, DEFAULT_ALERT_DEFINITION_UI_STATE) },
  data: [],
  alertDefinitions: [] as AlertDefinition[],
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
    setAlertDefinition: (state: AlertDefinitionState, action: PayloadAction<any>) => {
      return { ...state, alertDefinition: action.payload };
    },
    updateAlertDefinition: (state: AlertDefinitionState, action: PayloadAction<Partial<AlertDefinition>>) => {
      return { ...state, alertDefinition: { ...state.alertDefinition, ...action.payload } };
    },
    setUiState: (state: AlertDefinitionState, action: PayloadAction<AlertDefinitionUiState>) => {
      return { ...state, uiState: { ...state.uiState, ...action.payload } };
    },
    setQueryOptions: (state: AlertDefinitionState, action: PayloadAction<QueryGroupOptions>) => {
      return {
        ...state,
        queryOptions: action.payload,
      };
    },
    setAlertDefinitions: (state: AlertDefinitionState, action: PayloadAction<AlertDefinition[]>) => {
      return { ...state, alertDefinitions: action.payload };
    },
  },
});

export const { loadAlertRules, loadedAlertRules, setSearchQuery } = alertRulesSlice.actions;

export const {
  setNotificationChannels,
  notificationChannelLoaded,
  resetSecureField,
} = notificationChannelSlice.actions;

export const { setUiState, updateAlertDefinition, setQueryOptions, setAlertDefinitions } = alertDefinitionSlice.actions;

export const alertRulesReducer = alertRulesSlice.reducer;
export const notificationChannelReducer = notificationChannelSlice.reducer;
export const alertDefinitionsReducer = alertDefinitionSlice.reducer;

export default {
  alertRules: alertRulesReducer,
  notificationChannel: notificationChannelReducer,
  alertDefinition: alertDefinitionsReducer,
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

import { combineReducers } from 'redux';

import { createAsyncMapSlice, createAsyncSlice } from '../utils/redux';

import {
  deleteAlertManagerConfigAction,
  fetchAlertGroupsAction,
  fetchFolderAction,
  fetchGrafanaAnnotationsAction,
  fetchGrafanaNotifiersAction,
  fetchPromRulesAction,
  fetchRulerRulesAction,
  fetchRulesSourceBuildInfoAction,
  saveRuleFormAction,
  testReceiversAction,
  updateAlertManagerConfigAction,
} from './actions';

export const reducer = combineReducers({
  dataSources: createAsyncMapSlice(
    'dataSources',
    fetchRulesSourceBuildInfoAction,
    ({ rulesSourceName }) => rulesSourceName
  ).reducer,
  promRules: createAsyncMapSlice('promRules', fetchPromRulesAction, ({ rulesSourceName }) => rulesSourceName).reducer,
  rulerRules: createAsyncMapSlice('rulerRules', fetchRulerRulesAction, ({ rulesSourceName }) => rulesSourceName)
    .reducer,
  ruleForm: combineReducers({
    saveRule: createAsyncSlice('saveRule', saveRuleFormAction).reducer,
  }),
  grafanaNotifiers: createAsyncSlice('grafanaNotifiers', fetchGrafanaNotifiersAction).reducer,
  saveAMConfig: createAsyncSlice('saveAMConfig', updateAlertManagerConfigAction).reducer,
  deleteAMConfig: createAsyncSlice('deleteAMConfig', deleteAlertManagerConfigAction).reducer,
  folders: createAsyncMapSlice('folders', fetchFolderAction, (uid) => uid).reducer,
  amAlertGroups: createAsyncMapSlice(
    'amAlertGroups',
    fetchAlertGroupsAction,
    (alertManagerSourceName) => alertManagerSourceName
  ).reducer,
  testReceivers: createAsyncSlice('testReceivers', testReceiversAction).reducer,
  managedAlertStateHistory: createAsyncSlice('managedAlertStateHistory', fetchGrafanaAnnotationsAction).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;

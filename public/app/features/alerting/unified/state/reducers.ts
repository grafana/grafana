import { combineReducers } from 'redux';

import { createAsyncMapSlice, createAsyncSlice } from '../utils/redux';

import {
  createOrUpdateSilenceAction,
  deleteAlertManagerConfigAction,
  fetchAlertGroupsAction,
  fetchAlertManagerConfigAction,
  fetchAmAlertsAction,
  fetchEditableRuleAction,
  fetchExternalAlertmanagersAction,
  fetchExternalAlertmanagersConfigAction,
  fetchFolderAction,
  fetchGrafanaAnnotationsAction,
  fetchGrafanaNotifiersAction,
  fetchPromRulesAction,
  fetchRulerRulesAction,
  fetchRulesSourceBuildInfoAction,
  fetchSilencesAction,
  fetchValidAlertManagerConfigAction,
  saveRuleFormAction,
  testReceiversAction,
  updateAlertManagerConfigAction,
  updateLotexNamespaceAndGroupAction,
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
  amConfigs: createAsyncMapSlice(
    'amConfigs',
    fetchAlertManagerConfigAction,
    (alertManagerSourceName) => alertManagerSourceName
  ).reducer,
  validAmConfigs: createAsyncSlice('validAmConfigs', fetchValidAlertManagerConfigAction).reducer,
  silences: createAsyncMapSlice('silences', fetchSilencesAction, (alertManagerSourceName) => alertManagerSourceName)
    .reducer,
  ruleForm: combineReducers({
    saveRule: createAsyncSlice('saveRule', saveRuleFormAction).reducer,
    existingRule: createAsyncSlice('existingRule', fetchEditableRuleAction).reducer,
  }),
  grafanaNotifiers: createAsyncSlice('grafanaNotifiers', fetchGrafanaNotifiersAction).reducer,
  saveAMConfig: createAsyncSlice('saveAMConfig', updateAlertManagerConfigAction).reducer,
  deleteAMConfig: createAsyncSlice('deleteAMConfig', deleteAlertManagerConfigAction).reducer,
  updateSilence: createAsyncSlice('updateSilence', createOrUpdateSilenceAction).reducer,
  amAlerts: createAsyncMapSlice('amAlerts', fetchAmAlertsAction, (alertManagerSourceName) => alertManagerSourceName)
    .reducer,
  folders: createAsyncMapSlice('folders', fetchFolderAction, (uid) => uid).reducer,
  amAlertGroups: createAsyncMapSlice(
    'amAlertGroups',
    fetchAlertGroupsAction,
    (alertManagerSourceName) => alertManagerSourceName
  ).reducer,
  testReceivers: createAsyncSlice('testReceivers', testReceiversAction).reducer,
  updateLotexNamespaceAndGroup: createAsyncSlice('updateLotexNamespaceAndGroup', updateLotexNamespaceAndGroupAction)
    .reducer,
  externalAlertmanagers: combineReducers({
    alertmanagerConfig: createAsyncSlice('alertmanagerConfig', fetchExternalAlertmanagersConfigAction).reducer,
    discoveredAlertmanagers: createAsyncSlice('discoveredAlertmanagers', fetchExternalAlertmanagersAction).reducer,
  }),
  managedAlertStateHistory: createAsyncSlice('managedAlertStateHistory', fetchGrafanaAnnotationsAction).reducer,
});

export type UnifiedAlertingState = ReturnType<typeof reducer>;

export default reducer;

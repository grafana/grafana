import { combineReducers } from 'redux';
import { createAsyncMapSlice, createAsyncSlice } from '../utils/redux';
import { fetchAlertManagerConfigAction, fetchAmAlertsAction, fetchEditableRuleAction, fetchGrafanaNotifiersAction, fetchPromRulesAction, fetchRulerRulesAction, fetchSilencesAction, saveRuleFormAction, updateAlertManagerConfigAction, createOrUpdateSilenceAction, fetchFolderAction, fetchAlertGroupsAction, checkIfLotexSupportsEditingRulesAction, deleteAlertManagerConfigAction, testReceiversAction, updateLotexNamespaceAndGroupAction, fetchExternalAlertmanagersAction, fetchExternalAlertmanagersConfigAction, } from './actions';
export var reducer = combineReducers({
    promRules: createAsyncMapSlice('promRules', fetchPromRulesAction, function (_a) {
        var rulesSourceName = _a.rulesSourceName;
        return rulesSourceName;
    }).reducer,
    rulerRules: createAsyncMapSlice('rulerRules', fetchRulerRulesAction, function (_a) {
        var rulesSourceName = _a.rulesSourceName;
        return rulesSourceName;
    })
        .reducer,
    amConfigs: createAsyncMapSlice('amConfigs', fetchAlertManagerConfigAction, function (alertManagerSourceName) { return alertManagerSourceName; }).reducer,
    silences: createAsyncMapSlice('silences', fetchSilencesAction, function (alertManagerSourceName) { return alertManagerSourceName; })
        .reducer,
    ruleForm: combineReducers({
        saveRule: createAsyncSlice('saveRule', saveRuleFormAction).reducer,
        existingRule: createAsyncSlice('existingRule', fetchEditableRuleAction).reducer,
    }),
    grafanaNotifiers: createAsyncSlice('grafanaNotifiers', fetchGrafanaNotifiersAction).reducer,
    saveAMConfig: createAsyncSlice('saveAMConfig', updateAlertManagerConfigAction).reducer,
    deleteAMConfig: createAsyncSlice('deleteAMConfig', deleteAlertManagerConfigAction).reducer,
    updateSilence: createAsyncSlice('updateSilence', createOrUpdateSilenceAction).reducer,
    amAlerts: createAsyncMapSlice('amAlerts', fetchAmAlertsAction, function (alertManagerSourceName) { return alertManagerSourceName; })
        .reducer,
    folders: createAsyncMapSlice('folders', fetchFolderAction, function (uid) { return uid; }).reducer,
    amAlertGroups: createAsyncMapSlice('amAlertGroups', fetchAlertGroupsAction, function (alertManagerSourceName) { return alertManagerSourceName; }).reducer,
    lotexSupportsRuleEditing: createAsyncMapSlice('lotexSupportsRuleEditing', checkIfLotexSupportsEditingRulesAction, function (source) { return source; }).reducer,
    testReceivers: createAsyncSlice('testReceivers', testReceiversAction).reducer,
    updateLotexNamespaceAndGroup: createAsyncSlice('updateLotexNamespaceAndGroup', updateLotexNamespaceAndGroupAction)
        .reducer,
    externalAlertmanagers: combineReducers({
        alertmanagerConfig: createAsyncSlice('alertmanagerConfig', fetchExternalAlertmanagersConfigAction).reducer,
        discoveredAlertmanagers: createAsyncSlice('discoveredAlertmanagers', fetchExternalAlertmanagersAction).reducer,
    }),
});
export default reducer;
//# sourceMappingURL=reducers.js.map
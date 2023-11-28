import { __awaiter } from "tslib";
import { createAsyncThunk } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';
import { locationService } from '@grafana/runtime';
import { AlertRulesService } from 'app/percona/shared/services/AlertRules/AlertRules.service';
import { PromApplication, } from 'app/types/unified-alerting-dto';
import { backendSrv } from '../../../../core/services/backend_srv';
import { logInfo, LogMessages, withPerformanceLogging } from '../Analytics';
import { addAlertManagers, createOrUpdateSilence, deleteAlertManagerConfig, expireSilence, fetchAlertGroups, fetchAlerts, fetchExternalAlertmanagerConfig, fetchExternalAlertmanagers, fetchSilences, testReceivers, updateAlertManagerConfig, } from '../api/alertmanager';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { fetchAnnotations } from '../api/annotations';
import { discoverFeatures } from '../api/buildInfo';
import { fetchNotifiers } from '../api/grafana';
import { fetchRules } from '../api/prometheus';
import { deleteNamespace, deleteRulerRulesGroup, fetchRulerRules, setRulerRuleGroup, } from '../api/ruler';
import { formatCreateAPIPayload } from '../components/rule-editor/TemplateStep/TemplateStep.utils';
import { RuleFormType } from '../types/rule-form';
import { addDefaultsToAlertmanagerConfig, removeMuteTimingFromRoute } from '../utils/alertmanager';
import { getAllRulesSourceNames, getRulesDataSource, getRulesSourceName, GRAFANA_RULES_SOURCE_NAME, } from '../utils/datasource';
import { makeAMLink } from '../utils/misc';
import { withAppEvents, withSerializedError } from '../utils/redux';
import * as ruleId from '../utils/rule-id';
import { getRulerClient } from '../utils/rulerClient';
import { getAlertInfo, isRulerNotSupportedResponse } from '../utils/rules';
import { safeParseDurationstr } from '../utils/time';
function getDataSourceConfig(getState, rulesSourceName) {
    var _a;
    const dataSources = getState().unifiedAlerting.dataSources;
    const dsConfig = (_a = dataSources[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result;
    if (!dsConfig) {
        throw new Error(`Data source configuration is not available for "${rulesSourceName}" data source`);
    }
    return dsConfig;
}
function getDataSourceRulerConfig(getState, rulesSourceName) {
    const dsConfig = getDataSourceConfig(getState, rulesSourceName);
    if (!dsConfig.rulerConfig) {
        throw new Error(`Ruler API is not available for ${rulesSourceName}`);
    }
    return dsConfig.rulerConfig;
}
export const fetchPromRulesAction = createAsyncThunk('unifiedalerting/fetchPromRules', ({ rulesSourceName, filter, limitAlerts, matcher, state, identifier, }, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    yield thunkAPI.dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
    const fetchRulesWithLogging = withPerformanceLogging(fetchRules, `[${rulesSourceName}] Prometheus rules loaded`, {
        dataSourceName: rulesSourceName,
        thunk: 'unifiedalerting/fetchPromRules',
    });
    return yield withSerializedError(fetchRulesWithLogging(rulesSourceName, filter, limitAlerts, matcher, state, identifier));
}));
export const fetchExternalAlertmanagersAction = createAsyncThunk('unifiedAlerting/fetchExternalAlertmanagers', () => {
    return withSerializedError(fetchExternalAlertmanagers());
});
export const fetchExternalAlertmanagersConfigAction = createAsyncThunk('unifiedAlerting/fetchExternAlertmanagersConfig', () => {
    return withSerializedError(fetchExternalAlertmanagerConfig());
});
export const fetchRulerRulesAction = createAsyncThunk('unifiedalerting/fetchRulerRules', ({ rulesSourceName, filter, }, { dispatch, getState }) => __awaiter(void 0, void 0, void 0, function* () {
    yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
    const rulerConfig = getDataSourceRulerConfig(getState, rulesSourceName);
    const fetchRulerRulesWithLogging = withPerformanceLogging(fetchRulerRules, `[${rulesSourceName}] Ruler rules loaded`, {
        dataSourceName: rulesSourceName,
        thunk: 'unifiedalerting/fetchRulerRules',
    });
    return yield withSerializedError(fetchRulerRulesWithLogging(rulerConfig, filter));
}));
export function fetchPromAndRulerRulesAction({ rulesSourceName, identifier, filter, limitAlerts, matcher, state, }) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
        const dsConfig = getDataSourceConfig(getState, rulesSourceName);
        yield dispatch(fetchPromRulesAction({ rulesSourceName, identifier, filter, limitAlerts, matcher, state }));
        if (dsConfig.rulerConfig) {
            yield dispatch(fetchRulerRulesAction({ rulesSourceName }));
        }
    });
}
export const fetchSilencesAction = createAsyncThunk('unifiedalerting/fetchSilences', (alertManagerSourceName) => {
    const fetchSilencesWithLogging = withPerformanceLogging(fetchSilences, `[${alertManagerSourceName}] Silences loaded`, {
        dataSourceName: alertManagerSourceName,
        thunk: 'unifiedalerting/fetchSilences',
    });
    return withSerializedError(fetchSilencesWithLogging(alertManagerSourceName));
});
// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(rulesSourceName) {
    return (dispatch, getStore) => {
        const { rulerRules } = getStore().unifiedAlerting;
        const resp = rulerRules[rulesSourceName];
        const emptyResults = isEmpty(resp === null || resp === void 0 ? void 0 : resp.result);
        if (emptyResults && !(resp && isRulerNotSupportedResponse(resp)) && !(resp === null || resp === void 0 ? void 0 : resp.loading)) {
            dispatch(fetchRulerRulesAction({ rulesSourceName }));
        }
    };
}
// TODO: memoize this or move to RTK Query so we can cache results!
export function fetchAllPromBuildInfoAction() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const allRequests = getAllRulesSourceNames().map((rulesSourceName) => dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName })));
        yield Promise.allSettled(allRequests);
    });
}
export const fetchRulesSourceBuildInfoAction = createAsyncThunk('unifiedalerting/fetchPromBuildinfo', ({ rulesSourceName }) => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        if (rulesSourceName === GRAFANA_RULES_SOURCE_NAME) {
            return {
                name: GRAFANA_RULES_SOURCE_NAME,
                id: GRAFANA_RULES_SOURCE_NAME,
                rulerConfig: {
                    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
                    apiVersion: 'legacy',
                },
            };
        }
        const ds = getRulesDataSource(rulesSourceName);
        if (!ds) {
            throw new Error(`Missing data source configuration for ${rulesSourceName}`);
        }
        const { id, name } = ds;
        const discoverFeaturesWithLogging = withPerformanceLogging(discoverFeatures, `[${rulesSourceName}] Rules source features discovered`, {
            dataSourceName: rulesSourceName,
            thunk: 'unifiedalerting/fetchPromBuildinfo',
        });
        const buildInfo = yield discoverFeaturesWithLogging(name);
        const rulerConfig = buildInfo.features.rulerApiEnabled
            ? {
                dataSourceName: name,
                apiVersion: buildInfo.application === PromApplication.Cortex ? 'legacy' : 'config',
            }
            : undefined;
        return {
            name: name,
            id: id,
            rulerConfig,
        };
    }))());
}), {
    condition: ({ rulesSourceName }, { getState }) => {
        var _a, _b;
        const dataSources = getState().unifiedAlerting
            .dataSources;
        const hasLoaded = Boolean((_a = dataSources[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.result);
        const hasError = Boolean((_b = dataSources[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.error);
        return !(hasLoaded || hasError);
    },
});
export function fetchAllPromAndRulerRulesAction(force = false, options = {}) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const allStartLoadingTs = performance.now();
        yield Promise.allSettled(getAllRulesSourceNames().map((rulesSourceName) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName }));
            const { promRules, rulerRules, dataSources } = getStore().unifiedAlerting;
            const dataSourceConfig = dataSources[rulesSourceName].result;
            if (!dataSourceConfig) {
                return;
            }
            const shouldLoadProm = force || !((_a = promRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.loading);
            const shouldLoadRuler = (force || !((_b = rulerRules[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.loading)) && Boolean(dataSourceConfig.rulerConfig);
            yield Promise.allSettled([
                shouldLoadProm && dispatch(fetchPromRulesAction(Object.assign({ rulesSourceName }, options))),
                shouldLoadRuler && dispatch(fetchRulerRulesAction({ rulesSourceName })),
            ]);
        })));
        logInfo('All Prom and Ruler rules loaded', {
            loadTimeMs: (performance.now() - allStartLoadingTs).toFixed(0),
        });
    });
}
export function fetchAllPromRulesAction(force = false) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const { promRules } = getStore().unifiedAlerting;
        getAllRulesSourceNames().map((rulesSourceName) => {
            var _a;
            if (force || !((_a = promRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.loading)) {
                dispatch(fetchPromRulesAction({ rulesSourceName }));
            }
        });
    });
}
export const fetchEditableRuleAction = createAsyncThunk('unifiedalerting/fetchEditableRule', (ruleIdentifier, thunkAPI) => {
    const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, ruleIdentifier.ruleSourceName);
    return withSerializedError(getRulerClient(rulerConfig).findEditableRule(ruleIdentifier));
});
export function deleteRulesGroupAction(namespace, ruleGroup) {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        withAppEvents((() => __awaiter(this, void 0, void 0, function* () {
            const sourceName = getRulesSourceName(namespace.rulesSource);
            const rulerConfig = getDataSourceRulerConfig(getState, sourceName);
            yield deleteRulerRulesGroup(rulerConfig, namespace.name, ruleGroup.name);
            yield dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: sourceName }));
        }))(), { successMessage: 'Group deleted' });
    });
}
export function deleteRuleAction(ruleIdentifier, options = {}) {
    /*
     * fetch the rules group from backend, delete group if it is found and+
     * reload ruler rules
     */
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: ruleIdentifier.ruleSourceName }));
        withAppEvents((() => __awaiter(this, void 0, void 0, function* () {
            const rulerConfig = getDataSourceRulerConfig(getState, ruleIdentifier.ruleSourceName);
            const rulerClient = getRulerClient(rulerConfig);
            const ruleWithLocation = yield rulerClient.findEditableRule(ruleIdentifier);
            if (!ruleWithLocation) {
                throw new Error('Rule not found.');
            }
            yield rulerClient.deleteRule(ruleWithLocation);
            // refetch rules for this rules source
            yield dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: ruleWithLocation.ruleSourceName }));
            if (options.navigateTo) {
                locationService.replace(options.navigateTo);
            }
        }))(), {
            successMessage: 'Rule deleted.',
        });
    });
}
export const saveRuleFormAction = createAsyncThunk('unifiedalerting/saveRuleForm', ({ values, existing, redirectOnSave, evaluateEvery, }, thunkAPI) => withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const { type } = values;
    // TODO getRulerConfig should be smart enough to provide proper rulerClient implementation
    // For the dataSourceName specified
    // in case of system (cortex/loki)
    let identifier;
    if (type === RuleFormType.cloudAlerting || type === RuleFormType.cloudRecording) {
        if (!values.dataSourceName) {
            throw new Error('The Data source has not been defined.');
        }
        const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, values.dataSourceName);
        const rulerClient = getRulerClient(rulerConfig);
        identifier = yield rulerClient.saveLotexRule(values, evaluateEvery, existing);
        yield thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName: values.dataSourceName }));
        // in case of grafana managed
    }
    else if (type === RuleFormType.grafana) {
        const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, GRAFANA_RULES_SOURCE_NAME);
        const rulerClient = getRulerClient(rulerConfig);
        identifier = yield rulerClient.saveGrafanaRule(values, evaluateEvery, existing);
        yield thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
        // @PERCONA
        // @PERCONA_TODO check
        // Added our type case
    }
    else if (type === RuleFormType.templated) {
        yield AlertRulesService.create(formatCreateAPIPayload(values), undefined, true);
        identifier = { uid: '', ruleSourceName: 'grafana' };
    }
    else {
        throw new Error('Unexpected rule form type');
    }
    logInfo(LogMessages.successSavingAlertRule, { type, isNew: (!existing).toString() });
    if (redirectOnSave) {
        locationService.push(redirectOnSave);
    }
    else {
        // if the identifier comes up empty (this happens when Grafana managed rule moves to another namespace or group)
        const stringifiedIdentifier = ruleId.stringifyIdentifier(identifier);
        if (!stringifiedIdentifier) {
            locationService.push('/alerting/list');
            return;
        }
        // redirect to edit page
        const newLocation = `/alerting/${encodeURIComponent(stringifiedIdentifier)}/edit`;
        if (locationService.getLocation().pathname !== newLocation) {
            locationService.replace(newLocation);
        }
        else {
            // refresh the details of the current editable rule after saving
            thunkAPI.dispatch(fetchEditableRuleAction(identifier));
        }
    }
}))()), {
    successMessage: existing ? `Rule "${values.name}" updated.` : `Rule "${values.name}" saved.`,
    errorMessage: 'Failed to save rule',
}));
export const fetchGrafanaNotifiersAction = createAsyncThunk('unifiedalerting/fetchGrafanaNotifiers', () => withSerializedError(fetchNotifiers()));
export const fetchGrafanaAnnotationsAction = createAsyncThunk('unifiedalerting/fetchGrafanaAnnotations', (alertId) => withSerializedError(fetchAnnotations(alertId)));
export const updateAlertManagerConfigAction = createAsyncThunk('unifiedalerting/updateAMConfig', ({ alertManagerSourceName, oldConfig, newConfig, successMessage, redirectPath, redirectSearch }, thunkAPI) => withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const latestConfig = yield thunkAPI
        .dispatch(alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName))
        .unwrap();
    const isLatestConfigEmpty = isEmpty(latestConfig.alertmanager_config) && isEmpty(latestConfig.template_files);
    const oldLastConfigsDiffer = JSON.stringify(latestConfig) !== JSON.stringify(oldConfig);
    if (!isLatestConfigEmpty && oldLastConfigsDiffer) {
        throw new Error('A newer Alertmanager configuration is available. Please reload the page and try again to not overwrite recent changes.');
    }
    yield updateAlertManagerConfig(alertManagerSourceName, addDefaultsToAlertmanagerConfig(newConfig));
    thunkAPI.dispatch(alertmanagerApi.util.invalidateTags(['AlertmanagerConfiguration']));
    if (redirectPath) {
        const options = new URLSearchParams(redirectSearch !== null && redirectSearch !== void 0 ? redirectSearch : '');
        locationService.push(makeAMLink(redirectPath, alertManagerSourceName, options));
    }
}))()), {
    successMessage,
}));
export const fetchAmAlertsAction = createAsyncThunk('unifiedalerting/fetchAmAlerts', (alertManagerSourceName) => withSerializedError(fetchAlerts(alertManagerSourceName, [], true, true, true)));
export const expireSilenceAction = (alertManagerSourceName, silenceId) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        yield withAppEvents(expireSilence(alertManagerSourceName, silenceId), {
            successMessage: 'Silence expired.',
        });
        dispatch(fetchSilencesAction(alertManagerSourceName));
        dispatch(fetchAmAlertsAction(alertManagerSourceName));
    });
};
export const createOrUpdateSilenceAction = createAsyncThunk('unifiedalerting/updateSilence', ({ alertManagerSourceName, payload, exitOnSave, successMessage }) => withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    yield createOrUpdateSilence(alertManagerSourceName, payload);
    if (exitOnSave) {
        locationService.push('/alerting/silences');
    }
}))()), {
    successMessage,
}));
export const deleteReceiverAction = (receiverName, alertManagerSourceName) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const config = yield dispatch(alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName)).unwrap();
        if (!config) {
            throw new Error(`Config for ${alertManagerSourceName} not found`);
        }
        if (!((_a = config.alertmanager_config.receivers) === null || _a === void 0 ? void 0 : _a.find((receiver) => receiver.name === receiverName))) {
            throw new Error(`Cannot delete receiver ${receiverName}: not found in config.`);
        }
        const newConfig = Object.assign(Object.assign({}, config), { alertmanager_config: Object.assign(Object.assign({}, config.alertmanager_config), { receivers: config.alertmanager_config.receivers.filter((receiver) => receiver.name !== receiverName) }) });
        return dispatch(updateAlertManagerConfigAction({
            newConfig,
            oldConfig: config,
            alertManagerSourceName,
            successMessage: 'Contact point deleted.',
        }));
    });
};
export const deleteTemplateAction = (templateName, alertManagerSourceName) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const config = yield dispatch(alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName)).unwrap();
        if (!config) {
            throw new Error(`Config for ${alertManagerSourceName} not found`);
        }
        if (typeof ((_a = config.template_files) === null || _a === void 0 ? void 0 : _a[templateName]) !== 'string') {
            throw new Error(`Cannot delete template ${templateName}: not found in config.`);
        }
        const newTemplates = Object.assign({}, config.template_files);
        delete newTemplates[templateName];
        const newConfig = Object.assign(Object.assign({}, config), { alertmanager_config: Object.assign(Object.assign({}, config.alertmanager_config), { templates: (_b = config.alertmanager_config.templates) === null || _b === void 0 ? void 0 : _b.filter((existing) => existing !== templateName) }), template_files: newTemplates });
        return dispatch(updateAlertManagerConfigAction({
            newConfig,
            oldConfig: config,
            alertManagerSourceName,
            successMessage: 'Template deleted.',
        }));
    });
};
export const fetchFolderAction = createAsyncThunk('unifiedalerting/fetchFolder', (uid) => withSerializedError(backendSrv.getFolderByUid(uid, { withAccessControl: true })));
export const fetchFolderIfNotFetchedAction = (uid) => {
    return (dispatch, getState) => {
        var _a;
        if (!((_a = getState().unifiedAlerting.folders[uid]) === null || _a === void 0 ? void 0 : _a.dispatched)) {
            dispatch(fetchFolderAction(uid));
        }
    };
};
export const fetchAlertGroupsAction = createAsyncThunk('unifiedalerting/fetchAlertGroups', (alertManagerSourceName) => {
    return withSerializedError(fetchAlertGroups(alertManagerSourceName));
});
export const deleteAlertManagerConfigAction = createAsyncThunk('unifiedalerting/deleteAlertManagerConfig', (alertManagerSourceName, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield deleteAlertManagerConfig(alertManagerSourceName);
        yield thunkAPI.dispatch(alertmanagerApi.util.invalidateTags(['AlertmanagerConfiguration']));
    }))()), {
        errorMessage: 'Failed to reset Alertmanager configuration',
        successMessage: 'Alertmanager configuration reset.',
    });
}));
export const deleteMuteTimingAction = (alertManagerSourceName, muteTimingName) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const config = yield dispatch(alertmanagerApi.endpoints.getAlertmanagerConfiguration.initiate(alertManagerSourceName)).unwrap();
        const muteIntervals = (_c = (_b = (_a = config === null || config === void 0 ? void 0 : config.alertmanager_config) === null || _a === void 0 ? void 0 : _a.mute_time_intervals) === null || _b === void 0 ? void 0 : _b.filter(({ name }) => name !== muteTimingName)) !== null && _c !== void 0 ? _c : [];
        if (config) {
            withAppEvents(dispatch(updateAlertManagerConfigAction({
                alertManagerSourceName,
                oldConfig: config,
                newConfig: Object.assign(Object.assign({}, config), { alertmanager_config: Object.assign(Object.assign({}, config.alertmanager_config), { route: config.alertmanager_config.route
                            ? removeMuteTimingFromRoute(muteTimingName, (_d = config.alertmanager_config) === null || _d === void 0 ? void 0 : _d.route)
                            : undefined, mute_time_intervals: muteIntervals }) }),
            })), {
                successMessage: `Deleted "${muteTimingName}" from Alertmanager configuration`,
                errorMessage: 'Failed to delete mute timing',
            });
        }
    });
};
export const testReceiversAction = createAsyncThunk('unifiedalerting/testReceivers', ({ alertManagerSourceName, receivers, alert }) => {
    return withAppEvents(withSerializedError(testReceivers(alertManagerSourceName, receivers, alert)), {
        errorMessage: 'Failed to send test alert.',
        successMessage: 'Test alert sent.',
    });
});
export const rulesInSameGroupHaveInvalidFor = (rules, everyDuration) => {
    return rules.filter((rule) => {
        const { forDuration } = getAlertInfo(rule, everyDuration);
        const forNumber = safeParseDurationstr(forDuration);
        const everyNumber = safeParseDurationstr(everyDuration);
        return forNumber !== 0 && forNumber < everyNumber;
    });
};
// allows renaming namespace, renaming group and changing group interval, all in one go
export const updateLotexNamespaceAndGroupAction = createAsyncThunk('unifiedalerting/updateLotexNamespaceAndGroup', (options, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        const { rulesSourceName, namespaceName, groupName, newNamespaceName, newGroupName, groupInterval } = options;
        const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, rulesSourceName);
        // fetch rules and perform sanity checks
        const rulesResult = yield fetchRulerRules(rulerConfig);
        const existingNamespace = Boolean(rulesResult[namespaceName]);
        if (!existingNamespace) {
            throw new Error(`Namespace "${namespaceName}" not found.`);
        }
        const existingGroup = rulesResult[namespaceName].find((group) => group.name === groupName);
        if (!existingGroup) {
            throw new Error(`Group "${groupName}" not found.`);
        }
        const newGroupAlreadyExists = Boolean(rulesResult[namespaceName].find((group) => group.name === newGroupName));
        if (newGroupName !== groupName && newGroupAlreadyExists) {
            throw new Error(`Group "${newGroupName}" already exists in namespace "${namespaceName}".`);
        }
        const newNamespaceAlreadyExists = Boolean(rulesResult[newNamespaceName]);
        if (newNamespaceName !== namespaceName && newNamespaceAlreadyExists) {
            throw new Error(`Namespace "${newNamespaceName}" already exists.`);
        }
        if (newNamespaceName === namespaceName &&
            groupName === newGroupName &&
            groupInterval === existingGroup.interval) {
            throw new Error('Nothing changed.');
        }
        // validation for new groupInterval
        if (groupInterval !== existingGroup.interval) {
            const notValidRules = rulesInSameGroupHaveInvalidFor(existingGroup.rules, groupInterval !== null && groupInterval !== void 0 ? groupInterval : '1m');
            if (notValidRules.length > 0) {
                throw new Error(`These alerts belonging to this group will have an invalid 'For' value: ${notValidRules
                    .map((rule) => {
                    const { alertName } = getAlertInfo(rule, groupInterval !== null && groupInterval !== void 0 ? groupInterval : '');
                    return alertName;
                })
                    .join(',')}`);
            }
        }
        // if renaming namespace - make new copies of all groups, then delete old namespace
        if (newNamespaceName !== namespaceName) {
            for (const group of rulesResult[namespaceName]) {
                yield setRulerRuleGroup(rulerConfig, newNamespaceName, group.name === groupName
                    ? Object.assign(Object.assign({}, group), { name: newGroupName, interval: groupInterval }) : group);
            }
            yield deleteNamespace(rulerConfig, namespaceName);
            // if only modifying group...
        }
        else {
            // save updated group
            yield setRulerRuleGroup(rulerConfig, namespaceName, Object.assign(Object.assign({}, existingGroup), { name: newGroupName, interval: groupInterval }));
            // if group name was changed, delete old group
            if (newGroupName !== groupName) {
                yield deleteRulerRulesGroup(rulerConfig, namespaceName, groupName);
            }
        }
        // refetch all rules
        yield thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }))()), {
        errorMessage: 'Failed to update namespace / group',
        successMessage: 'Update successful',
    });
}));
export const updateRulesOrder = createAsyncThunk('unifiedalerting/updateRulesOrderForGroup', (options, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        const { rulesSourceName, namespaceName, groupName, newRules } = options;
        const rulerConfig = getDataSourceRulerConfig(thunkAPI.getState, rulesSourceName);
        const rulesResult = yield fetchRulerRules(rulerConfig);
        const existingGroup = rulesResult[namespaceName].find((group) => group.name === groupName);
        if (!existingGroup) {
            throw new Error(`Group "${groupName}" not found.`);
        }
        const payload = {
            name: existingGroup.name,
            interval: existingGroup.interval,
            rules: newRules,
        };
        yield setRulerRuleGroup(rulerConfig, namespaceName, payload);
        yield thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName }));
    }))()), {
        errorMessage: 'Failed to update namespace / group',
        successMessage: 'Update successful',
    });
}));
export const addExternalAlertmanagersAction = createAsyncThunk('unifiedAlerting/addExternalAlertmanagers', (alertmanagerConfig, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    return withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
        yield addAlertManagers(alertmanagerConfig);
        thunkAPI.dispatch(fetchExternalAlertmanagersConfigAction());
    }))()), {
        errorMessage: 'Failed adding alertmanagers',
        successMessage: 'Alertmanagers updated',
    });
}));
//# sourceMappingURL=actions.js.map
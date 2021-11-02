import { __assign, __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import { getBackendSrv, locationService } from '@grafana/runtime';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchNotifiers } from '../api/grafana';
import { expireSilence, fetchAlertManagerConfig, fetchAlerts, fetchAlertGroups, fetchSilences, createOrUpdateSilence, updateAlertManagerConfig, fetchStatus, deleteAlertManagerConfig, testReceivers, addAlertManagers, fetchExternalAlertmanagers, fetchExternalAlertmanagerConfig, } from '../api/alertmanager';
import { fetchRules } from '../api/prometheus';
import { deleteNamespace, deleteRulerRulesGroup, fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup, } from '../api/ruler';
import { RuleFormType } from '../types/rule-form';
import { getAllRulesSourceNames, GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource, isVanillaPrometheusAlertManagerDataSource, } from '../utils/datasource';
import { makeAMLink, retryWhile } from '../utils/misc';
import { isFetchError, withAppEvents, withSerializedError } from '../utils/redux';
import { formValuesToRulerRuleDTO, formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import { isCloudRuleIdentifier, isGrafanaRuleIdentifier, isGrafanaRulerRule, isPrometheusRuleIdentifier, isRulerNotSupportedResponse, } from '../utils/rules';
import { addDefaultsToAlertmanagerConfig } from '../utils/alertmanager';
import * as ruleId from '../utils/rule-id';
import { isEmpty } from 'lodash';
import messageFromError from 'app/plugins/datasource/grafana-azure-monitor-datasource/utils/messageFromError';
var FETCH_CONFIG_RETRY_TIMEOUT = 30 * 1000;
export var fetchPromRulesAction = createAsyncThunk('unifiedalerting/fetchPromRules', function (_a) {
    var rulesSourceName = _a.rulesSourceName, filter = _a.filter;
    return withSerializedError(fetchRules(rulesSourceName, filter));
});
export var fetchAlertManagerConfigAction = createAsyncThunk('unifiedalerting/fetchAmConfig', function (alertManagerSourceName) {
    return withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // for vanilla prometheus, there is no config endpoint. Only fetch config from status
            if (isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName)) {
                return [2 /*return*/, fetchStatus(alertManagerSourceName).then(function (status) { return ({
                        alertmanager_config: status.config,
                        template_files: {},
                    }); })];
            }
            return [2 /*return*/, retryWhile(function () { return fetchAlertManagerConfig(alertManagerSourceName); }, 
                // if config has been recently deleted, it takes a while for cortex start returning the default one.
                // retry for a short while instead of failing
                function (e) { var _a; return !!((_a = messageFromError(e)) === null || _a === void 0 ? void 0 : _a.includes('alertmanager storage object not found')); }, FETCH_CONFIG_RETRY_TIMEOUT).then(function (result) {
                    // if user config is empty for cortex alertmanager, try to get config from status endpoint
                    if (isEmpty(result.alertmanager_config) &&
                        isEmpty(result.template_files) &&
                        alertManagerSourceName !== GRAFANA_RULES_SOURCE_NAME) {
                        return fetchStatus(alertManagerSourceName).then(function (status) { return ({
                            alertmanager_config: status.config,
                            template_files: {},
                        }); });
                    }
                    return result;
                })];
        });
    }); })());
});
export var fetchExternalAlertmanagersAction = createAsyncThunk('unifiedAlerting/fetchExternalAlertmanagers', function () {
    return withSerializedError(fetchExternalAlertmanagers());
});
export var fetchExternalAlertmanagersConfigAction = createAsyncThunk('unifiedAlerting/fetchExternAlertmanagersConfig', function () {
    return withSerializedError(fetchExternalAlertmanagerConfig());
});
export var fetchRulerRulesAction = createAsyncThunk('unifiedalerting/fetchRulerRules', function (_a) {
    var rulesSourceName = _a.rulesSourceName, filter = _a.filter;
    return withSerializedError(fetchRulerRules(rulesSourceName, filter));
});
export var fetchSilencesAction = createAsyncThunk('unifiedalerting/fetchSilences', function (alertManagerSourceName) {
    return withSerializedError(fetchSilences(alertManagerSourceName));
});
// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(rulesSourceName) {
    return function (dispatch, getStore) {
        var rulerRules = getStore().unifiedAlerting.rulerRules;
        var resp = rulerRules[rulesSourceName];
        if (!(resp === null || resp === void 0 ? void 0 : resp.result) && !(resp && isRulerNotSupportedResponse(resp)) && !(resp === null || resp === void 0 ? void 0 : resp.loading)) {
            dispatch(fetchRulerRulesAction({ rulesSourceName: rulesSourceName }));
        }
    };
}
export function fetchAllPromAndRulerRulesAction(force) {
    if (force === void 0) { force = false; }
    return function (dispatch, getStore) {
        var _a = getStore().unifiedAlerting, promRules = _a.promRules, rulerRules = _a.rulerRules;
        getAllRulesSourceNames().map(function (rulesSourceName) {
            var _a, _b;
            if (force || !((_a = promRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.loading)) {
                dispatch(fetchPromRulesAction({ rulesSourceName: rulesSourceName }));
            }
            if (force || !((_b = rulerRules[rulesSourceName]) === null || _b === void 0 ? void 0 : _b.loading)) {
                dispatch(fetchRulerRulesAction({ rulesSourceName: rulesSourceName }));
            }
        });
    };
}
export function fetchAllPromRulesAction(force) {
    if (force === void 0) { force = false; }
    return function (dispatch, getStore) {
        var promRules = getStore().unifiedAlerting.promRules;
        getAllRulesSourceNames().map(function (rulesSourceName) {
            var _a;
            if (force || !((_a = promRules[rulesSourceName]) === null || _a === void 0 ? void 0 : _a.loading)) {
                dispatch(fetchPromRulesAction({ rulesSourceName: rulesSourceName }));
            }
        });
    };
}
function findEditableRule(ruleIdentifier) {
    return __awaiter(this, void 0, void 0, function () {
        var namespaces, _a, _b, _c, namespace, groups, groups_1, groups_1_1, group, rule, ruleSourceName_1, namespace_1, groupName, group_1, rule;
        var e_1, _d, e_2, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!isGrafanaRuleIdentifier(ruleIdentifier)) return [3 /*break*/, 2];
                    return [4 /*yield*/, fetchRulerRules(GRAFANA_RULES_SOURCE_NAME)];
                case 1:
                    namespaces = _f.sent();
                    try {
                        // find namespace and group that contains the uid for the rule
                        for (_a = __values(Object.entries(namespaces)), _b = _a.next(); !_b.done; _b = _a.next()) {
                            _c = __read(_b.value, 2), namespace = _c[0], groups = _c[1];
                            try {
                                for (groups_1 = (e_2 = void 0, __values(groups)), groups_1_1 = groups_1.next(); !groups_1_1.done; groups_1_1 = groups_1.next()) {
                                    group = groups_1_1.value;
                                    rule = group.rules.find(function (rule) { var _a; return isGrafanaRulerRule(rule) && ((_a = rule.grafana_alert) === null || _a === void 0 ? void 0 : _a.uid) === ruleIdentifier.uid; });
                                    if (rule) {
                                        return [2 /*return*/, {
                                                group: group,
                                                ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
                                                namespace: namespace,
                                                rule: rule,
                                            }];
                                    }
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (groups_1_1 && !groups_1_1.done && (_e = groups_1.return)) _e.call(groups_1);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    _f.label = 2;
                case 2:
                    if (!isCloudRuleIdentifier(ruleIdentifier)) return [3 /*break*/, 4];
                    ruleSourceName_1 = ruleIdentifier.ruleSourceName, namespace_1 = ruleIdentifier.namespace, groupName = ruleIdentifier.groupName;
                    return [4 /*yield*/, fetchRulerRulesGroup(ruleSourceName_1, namespace_1, groupName)];
                case 3:
                    group_1 = _f.sent();
                    if (!group_1) {
                        return [2 /*return*/, null];
                    }
                    rule = group_1.rules.find(function (rule) {
                        var identifier = ruleId.fromRulerRule(ruleSourceName_1, namespace_1, group_1.name, rule);
                        return ruleId.equal(identifier, ruleIdentifier);
                    });
                    if (!rule) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, {
                            group: group_1,
                            ruleSourceName: ruleSourceName_1,
                            namespace: namespace_1,
                            rule: rule,
                        }];
                case 4:
                    if (isPrometheusRuleIdentifier(ruleIdentifier)) {
                        throw new Error('Native prometheus rules can not be edited in grafana.');
                    }
                    return [2 /*return*/, null];
            }
        });
    });
}
export var fetchEditableRuleAction = createAsyncThunk('unifiedalerting/fetchEditableRule', function (ruleIdentifier) {
    return withSerializedError(findEditableRule(ruleIdentifier));
});
function deleteRule(ruleWithLocation) {
    return __awaiter(this, void 0, void 0, function () {
        var ruleSourceName, namespace, group, rule;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ruleSourceName = ruleWithLocation.ruleSourceName, namespace = ruleWithLocation.namespace, group = ruleWithLocation.group, rule = ruleWithLocation.rule;
                    if (!isGrafanaRulesSource(ruleSourceName)) return [3 /*break*/, 2];
                    return [4 /*yield*/, deleteRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, namespace, group.name)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2:
                    if (!(group.rules.length === 1)) return [3 /*break*/, 4];
                    return [4 /*yield*/, deleteRulerRulesGroup(ruleSourceName, namespace, group.name)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4: 
                // post the group with rule removed
                return [4 /*yield*/, setRulerRuleGroup(ruleSourceName, namespace, __assign(__assign({}, group), { rules: group.rules.filter(function (r) { return r !== rule; }) }))];
                case 5:
                    // post the group with rule removed
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function deleteRuleAction(ruleIdentifier, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    /*
     * fetch the rules group from backend, delete group if it is found and+
     * reload ruler rules
     */
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            withAppEvents((function () { return __awaiter(_this, void 0, void 0, function () {
                var ruleWithLocation;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, findEditableRule(ruleIdentifier)];
                        case 1:
                            ruleWithLocation = _a.sent();
                            if (!ruleWithLocation) {
                                throw new Error('Rule not found.');
                            }
                            return [4 /*yield*/, deleteRule(ruleWithLocation)];
                        case 2:
                            _a.sent();
                            // refetch rules for this rules source
                            dispatch(fetchRulerRulesAction({ rulesSourceName: ruleWithLocation.ruleSourceName }));
                            dispatch(fetchPromRulesAction({ rulesSourceName: ruleWithLocation.ruleSourceName }));
                            if (options.navigateTo) {
                                locationService.replace(options.navigateTo);
                            }
                            return [2 /*return*/];
                    }
                });
            }); })(), {
                successMessage: 'Rule deleted.',
            });
            return [2 /*return*/];
        });
    }); };
}
function saveLotexRule(values, existing) {
    return __awaiter(this, void 0, void 0, function () {
        var dataSourceName, group, namespace, formRule, freshExisting_1, payload_1, targetGroup, payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dataSourceName = values.dataSourceName, group = values.group, namespace = values.namespace;
                    formRule = formValuesToRulerRuleDTO(values);
                    if (!(dataSourceName && group && namespace)) return [3 /*break*/, 8];
                    if (!existing) return [3 /*break*/, 5];
                    return [4 /*yield*/, findEditableRule(ruleId.fromRuleWithLocation(existing))];
                case 1:
                    freshExisting_1 = _a.sent();
                    if (!freshExisting_1) {
                        throw new Error('Rule not found.');
                    }
                    if (!(freshExisting_1.namespace !== namespace || freshExisting_1.group.name !== group)) return [3 /*break*/, 3];
                    return [4 /*yield*/, deleteRule(freshExisting_1)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    payload_1 = __assign(__assign({}, freshExisting_1.group), { rules: freshExisting_1.group.rules.map(function (existingRule) {
                            return existingRule === freshExisting_1.rule ? formRule : existingRule;
                        }) });
                    return [4 /*yield*/, setRulerRuleGroup(dataSourceName, namespace, payload_1)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, ruleId.fromRulerRule(dataSourceName, namespace, group, formRule)];
                case 5: return [4 /*yield*/, fetchRulerRulesGroup(dataSourceName, namespace, group)];
                case 6:
                    targetGroup = _a.sent();
                    payload = targetGroup
                        ? __assign(__assign({}, targetGroup), { rules: __spreadArray(__spreadArray([], __read(targetGroup.rules), false), [formRule], false) }) : {
                        name: group,
                        rules: [formRule],
                    };
                    return [4 /*yield*/, setRulerRuleGroup(dataSourceName, namespace, payload)];
                case 7:
                    _a.sent();
                    return [2 /*return*/, ruleId.fromRulerRule(dataSourceName, namespace, group, formRule)];
                case 8: throw new Error('Data source and location must be specified');
            }
        });
    });
}
function saveGrafanaRule(values, existing) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var folder, evaluateEvery, formRule, freshExisting, uid, existingNamespace, group_2, idx, payload, result, newUid;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    folder = values.folder, evaluateEvery = values.evaluateEvery;
                    formRule = formValuesToRulerGrafanaRuleDTO(values);
                    if (!folder) return [3 /*break*/, 9];
                    if (!existing) return [3 /*break*/, 5];
                    return [4 /*yield*/, findEditableRule(ruleId.fromRuleWithLocation(existing))];
                case 1:
                    freshExisting = _c.sent();
                    if (!freshExisting) {
                        throw new Error('Rule not found.');
                    }
                    if (!(freshExisting.namespace !== folder.title)) return [3 /*break*/, 3];
                    return [4 /*yield*/, deleteRule(freshExisting)];
                case 2:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 3:
                    uid = freshExisting.rule.grafana_alert.uid;
                    formRule.grafana_alert.uid = uid;
                    return [4 /*yield*/, setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, freshExisting.namespace, {
                            name: freshExisting.group.name,
                            interval: evaluateEvery,
                            rules: [formRule],
                        })];
                case 4:
                    _c.sent();
                    return [2 /*return*/, { uid: uid }];
                case 5: return [4 /*yield*/, fetchRulerRulesNamespace(GRAFANA_RULES_SOURCE_NAME, folder.title)];
                case 6:
                    existingNamespace = _c.sent();
                    group_2 = values.name;
                    idx = 1;
                    while (!!existingNamespace.find(function (g) { return g.name === group_2; })) {
                        group_2 = values.name + "-" + ++idx;
                    }
                    payload = {
                        name: group_2,
                        interval: evaluateEvery,
                        rules: [formRule],
                    };
                    return [4 /*yield*/, setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, payload)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, fetchRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, group_2)];
                case 8:
                    result = _c.sent();
                    newUid = (_b = (_a = result === null || result === void 0 ? void 0 : result.rules[0]) === null || _a === void 0 ? void 0 : _a.grafana_alert) === null || _b === void 0 ? void 0 : _b.uid;
                    if (newUid) {
                        return [2 /*return*/, { uid: newUid }];
                    }
                    else {
                        throw new Error('Failed to fetch created rule.');
                    }
                    return [3 /*break*/, 10];
                case 9: throw new Error('Folder must be specified');
                case 10: return [2 /*return*/];
            }
        });
    });
}
export var saveRuleFormAction = createAsyncThunk('unifiedalerting/saveRuleForm', function (_a) {
    var values = _a.values, existing = _a.existing, redirectOnSave = _a.redirectOnSave;
    return withAppEvents(withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
        var type, identifier, newLocation;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    type = values.type;
                    if (!(type === RuleFormType.cloudAlerting || type === RuleFormType.cloudRecording)) return [3 /*break*/, 2];
                    return [4 /*yield*/, saveLotexRule(values, existing)];
                case 1:
                    identifier = _a.sent();
                    return [3 /*break*/, 5];
                case 2:
                    if (!(type === RuleFormType.grafana)) return [3 /*break*/, 4];
                    return [4 /*yield*/, saveGrafanaRule(values, existing)];
                case 3:
                    identifier = _a.sent();
                    return [3 /*break*/, 5];
                case 4: throw new Error('Unexpected rule form type');
                case 5:
                    if (redirectOnSave) {
                        locationService.push(redirectOnSave);
                    }
                    else {
                        newLocation = "/alerting/" + encodeURIComponent(ruleId.stringifyIdentifier(identifier)) + "/edit";
                        if (locationService.getLocation().pathname !== newLocation) {
                            locationService.replace(newLocation);
                        }
                    }
                    return [2 /*return*/];
            }
        });
    }); })()), {
        successMessage: existing ? "Rule \"" + values.name + "\" updated." : "Rule \"" + values.name + "\" saved.",
        errorMessage: 'Failed to save rule',
    });
});
export var fetchGrafanaNotifiersAction = createAsyncThunk('unifiedalerting/fetchGrafanaNotifiers', function () { return withSerializedError(fetchNotifiers()); });
export var updateAlertManagerConfigAction = createAsyncThunk('unifiedalerting/updateAMConfig', function (_a, thunkAPI) {
    var alertManagerSourceName = _a.alertManagerSourceName, oldConfig = _a.oldConfig, newConfig = _a.newConfig, successMessage = _a.successMessage, redirectPath = _a.redirectPath, refetch = _a.refetch;
    return withAppEvents(withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
        var latestConfig;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchAlertManagerConfig(alertManagerSourceName)];
                case 1:
                    latestConfig = _a.sent();
                    if (!(isEmpty(latestConfig.alertmanager_config) && isEmpty(latestConfig.template_files)) &&
                        JSON.stringify(latestConfig) !== JSON.stringify(oldConfig)) {
                        throw new Error('It seems configuration has been recently updated. Please reload page and try again to make sure that recent changes are not overwritten.');
                    }
                    return [4 /*yield*/, updateAlertManagerConfig(alertManagerSourceName, addDefaultsToAlertmanagerConfig(newConfig))];
                case 2:
                    _a.sent();
                    if (!refetch) return [3 /*break*/, 4];
                    return [4 /*yield*/, thunkAPI.dispatch(fetchAlertManagerConfigAction(alertManagerSourceName))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    if (redirectPath) {
                        locationService.push(makeAMLink(redirectPath, alertManagerSourceName));
                    }
                    return [2 /*return*/];
            }
        });
    }); })()), {
        successMessage: successMessage,
    });
});
export var fetchAmAlertsAction = createAsyncThunk('unifiedalerting/fetchAmAlerts', function (alertManagerSourceName) {
    return withSerializedError(fetchAlerts(alertManagerSourceName, [], true, true, true));
});
export var expireSilenceAction = function (alertManagerSourceName, silenceId) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, withAppEvents(expireSilence(alertManagerSourceName, silenceId), {
                        successMessage: 'Silence expired.',
                    })];
                case 1:
                    _a.sent();
                    dispatch(fetchSilencesAction(alertManagerSourceName));
                    dispatch(fetchAmAlertsAction(alertManagerSourceName));
                    return [2 /*return*/];
            }
        });
    }); };
};
export var createOrUpdateSilenceAction = createAsyncThunk('unifiedalerting/updateSilence', function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName, payload = _a.payload, exitOnSave = _a.exitOnSave, successMessage = _a.successMessage;
    return withAppEvents(withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createOrUpdateSilence(alertManagerSourceName, payload)];
                case 1:
                    _a.sent();
                    if (exitOnSave) {
                        locationService.push('/alerting/silences');
                    }
                    return [2 /*return*/];
            }
        });
    }); })()), {
        successMessage: successMessage,
    });
});
export var deleteReceiverAction = function (receiverName, alertManagerSourceName) {
    return function (dispatch, getState) {
        var _a, _b, _c;
        var config = (_b = (_a = getState().unifiedAlerting.amConfigs) === null || _a === void 0 ? void 0 : _a[alertManagerSourceName]) === null || _b === void 0 ? void 0 : _b.result;
        if (!config) {
            throw new Error("Config for " + alertManagerSourceName + " not found");
        }
        if (!((_c = config.alertmanager_config.receivers) === null || _c === void 0 ? void 0 : _c.find(function (receiver) { return receiver.name === receiverName; }))) {
            throw new Error("Cannot delete receiver " + receiverName + ": not found in config.");
        }
        var newConfig = __assign(__assign({}, config), { alertmanager_config: __assign(__assign({}, config.alertmanager_config), { receivers: config.alertmanager_config.receivers.filter(function (receiver) { return receiver.name !== receiverName; }) }) });
        return dispatch(updateAlertManagerConfigAction({
            newConfig: newConfig,
            oldConfig: config,
            alertManagerSourceName: alertManagerSourceName,
            successMessage: 'Contact point deleted.',
            refetch: true,
        }));
    };
};
export var deleteTemplateAction = function (templateName, alertManagerSourceName) {
    return function (dispatch, getState) {
        var _a, _b, _c, _d;
        var config = (_b = (_a = getState().unifiedAlerting.amConfigs) === null || _a === void 0 ? void 0 : _a[alertManagerSourceName]) === null || _b === void 0 ? void 0 : _b.result;
        if (!config) {
            throw new Error("Config for " + alertManagerSourceName + " not found");
        }
        if (typeof ((_c = config.template_files) === null || _c === void 0 ? void 0 : _c[templateName]) !== 'string') {
            throw new Error("Cannot delete template " + templateName + ": not found in config.");
        }
        var newTemplates = __assign({}, config.template_files);
        delete newTemplates[templateName];
        var newConfig = __assign(__assign({}, config), { alertmanager_config: __assign(__assign({}, config.alertmanager_config), { templates: (_d = config.alertmanager_config.templates) === null || _d === void 0 ? void 0 : _d.filter(function (existing) { return existing !== templateName; }) }), template_files: newTemplates });
        return dispatch(updateAlertManagerConfigAction({
            newConfig: newConfig,
            oldConfig: config,
            alertManagerSourceName: alertManagerSourceName,
            successMessage: 'Template deleted.',
            refetch: true,
        }));
    };
};
export var fetchFolderAction = createAsyncThunk('unifiedalerting/fetchFolder', function (uid) { return withSerializedError(getBackendSrv().getFolderByUid(uid)); });
export var fetchFolderIfNotFetchedAction = function (uid) {
    return function (dispatch, getState) {
        var _a;
        if (!((_a = getState().unifiedAlerting.folders[uid]) === null || _a === void 0 ? void 0 : _a.dispatched)) {
            dispatch(fetchFolderAction(uid));
        }
    };
};
export var fetchAlertGroupsAction = createAsyncThunk('unifiedalerting/fetchAlertGroups', function (alertManagerSourceName) {
    return withSerializedError(fetchAlertGroups(alertManagerSourceName));
});
export var checkIfLotexSupportsEditingRulesAction = createAsyncThunk('unifiedalerting/checkIfLotexRuleEditingSupported', function (rulesSourceName) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, withAppEvents((function () { return __awaiter(void 0, void 0, void 0, function () {
                var e_3;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, fetchRulerRulesGroup(rulesSourceName, 'test', 'test')];
                        case 1:
                            _d.sent();
                            return [2 /*return*/, true];
                        case 2:
                            e_3 = _d.sent();
                            if ((isFetchError(e_3) &&
                                (((_a = e_3.data.message) === null || _a === void 0 ? void 0 : _a.includes('GetRuleGroup unsupported in rule local store')) || // "local" rule storage
                                    ((_b = e_3.data.message) === null || _b === void 0 ? void 0 : _b.includes('page not found')))) || // ruler api disabled
                                ((_c = e_3.message) === null || _c === void 0 ? void 0 : _c.includes('404 from rules config endpoint')) // ruler api disabled
                            ) {
                                return [2 /*return*/, false];
                            }
                            throw e_3;
                        case 3: return [2 /*return*/];
                    }
                });
            }); })(), {
                errorMessage: "Failed to determine if \"" + rulesSourceName + "\" allows editing rules",
            })];
    });
}); });
export var deleteAlertManagerConfigAction = createAsyncThunk('unifiedalerting/deleteAlertManagerConfig', function (alertManagerSourceName, thunkAPI) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, withAppEvents(withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, deleteAlertManagerConfig(alertManagerSourceName)];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, thunkAPI.dispatch(fetchAlertManagerConfigAction(alertManagerSourceName))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); })()), {
                errorMessage: 'Failed to reset Alertmanager configuration',
                successMessage: 'Alertmanager configuration reset.',
            })];
    });
}); });
export var testReceiversAction = createAsyncThunk('unifiedalerting/testReceivers', function (_a) {
    var alertManagerSourceName = _a.alertManagerSourceName, receivers = _a.receivers;
    return withAppEvents(withSerializedError(testReceivers(alertManagerSourceName, receivers)), {
        errorMessage: 'Failed to send test alert.',
        successMessage: 'Test alert sent.',
    });
});
// allows renaming namespace, renaming group and changing group interval, all in one go
export var updateLotexNamespaceAndGroupAction = createAsyncThunk('unifiedalerting/updateLotexNamespaceAndGroup', function (options, thunkAPI) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, withAppEvents(withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
                var rulesSourceName, namespaceName, groupName, newNamespaceName, newGroupName, groupInterval, rulesResult, existingGroup, _a, _b, group, e_4_1;
                var e_4, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            rulesSourceName = options.rulesSourceName, namespaceName = options.namespaceName, groupName = options.groupName, newNamespaceName = options.newNamespaceName, newGroupName = options.newGroupName, groupInterval = options.groupInterval;
                            if (options.rulesSourceName === GRAFANA_RULES_SOURCE_NAME) {
                                throw new Error("this action does not support Grafana rules");
                            }
                            return [4 /*yield*/, fetchRulerRules(rulesSourceName)];
                        case 1:
                            rulesResult = _d.sent();
                            if (!rulesResult[namespaceName]) {
                                throw new Error("Namespace \"" + namespaceName + "\" not found.");
                            }
                            existingGroup = rulesResult[namespaceName].find(function (group) { return group.name === groupName; });
                            if (!existingGroup) {
                                throw new Error("Group \"" + groupName + "\" not found.");
                            }
                            if (newGroupName !== groupName && !!rulesResult[namespaceName].find(function (group) { return group.name === newGroupName; })) {
                                throw new Error("Group \"" + newGroupName + "\" already exists.");
                            }
                            if (newNamespaceName !== namespaceName && !!rulesResult[newNamespaceName]) {
                                throw new Error("Namespace \"" + newNamespaceName + "\" already exists.");
                            }
                            if (newNamespaceName === namespaceName &&
                                groupName === newGroupName &&
                                groupInterval === existingGroup.interval) {
                                throw new Error('Nothing changed.');
                            }
                            if (!(newNamespaceName !== namespaceName)) return [3 /*break*/, 11];
                            _d.label = 2;
                        case 2:
                            _d.trys.push([2, 7, 8, 9]);
                            _a = __values(rulesResult[namespaceName]), _b = _a.next();
                            _d.label = 3;
                        case 3:
                            if (!!_b.done) return [3 /*break*/, 6];
                            group = _b.value;
                            return [4 /*yield*/, setRulerRuleGroup(rulesSourceName, newNamespaceName, group.name === groupName
                                    ? __assign(__assign({}, group), { name: newGroupName, interval: groupInterval }) : group)];
                        case 4:
                            _d.sent();
                            _d.label = 5;
                        case 5:
                            _b = _a.next();
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 9];
                        case 7:
                            e_4_1 = _d.sent();
                            e_4 = { error: e_4_1 };
                            return [3 /*break*/, 9];
                        case 8:
                            try {
                                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                            }
                            finally { if (e_4) throw e_4.error; }
                            return [7 /*endfinally*/];
                        case 9: return [4 /*yield*/, deleteNamespace(rulesSourceName, namespaceName)];
                        case 10:
                            _d.sent();
                            return [3 /*break*/, 14];
                        case 11: 
                        // save updated group
                        return [4 /*yield*/, setRulerRuleGroup(rulesSourceName, namespaceName, __assign(__assign({}, existingGroup), { name: newGroupName, interval: groupInterval }))];
                        case 12:
                            // save updated group
                            _d.sent();
                            if (!(newGroupName !== groupName)) return [3 /*break*/, 14];
                            return [4 /*yield*/, deleteRulerRulesGroup(rulesSourceName, namespaceName, groupName)];
                        case 13:
                            _d.sent();
                            _d.label = 14;
                        case 14: 
                        // refetch all rules
                        return [4 /*yield*/, thunkAPI.dispatch(fetchRulerRulesAction({ rulesSourceName: rulesSourceName }))];
                        case 15:
                            // refetch all rules
                            _d.sent();
                            return [2 /*return*/];
                    }
                });
            }); })()), {
                errorMessage: 'Failed to update namespace / group',
                successMessage: 'Update successful',
            })];
    });
}); });
export var addExternalAlertmanagersAction = createAsyncThunk('unifiedAlerting/addExternalAlertmanagers', function (alertManagerUrls, thunkAPI) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, withAppEvents(withSerializedError((function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, addAlertManagers(alertManagerUrls)];
                        case 1:
                            _a.sent();
                            thunkAPI.dispatch(fetchExternalAlertmanagersConfigAction());
                            return [2 /*return*/];
                    }
                });
            }); })()), {
                errorMessage: 'Failed adding alertmanagers',
                successMessage: 'Alertmanagers updated',
            })];
    });
}); });
//# sourceMappingURL=actions.js.map
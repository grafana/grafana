import { __assign, __awaiter, __generator, __values } from "tslib";
import angular from 'angular';
import { castArray, isEqual } from 'lodash';
import { LoadingState } from '@grafana/data';
import { initialVariableModelState, VariableHide, VariableRefresh, } from '../types';
import { getVariable, getVariables } from './selectors';
import { variableAdapters } from '../adapters';
import { Graph } from '../../../core/utils/dag';
import { notifyApp } from 'app/core/actions';
import { addVariable, changeVariableProp, setCurrentVariableValue, variableStateCompleted, variableStateFailed, variableStateFetching, variableStateNotStarted, } from './sharedReducer';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, toVariableIdentifier, toVariablePayload, } from './types';
import { contextSrv } from 'app/core/services/context_srv';
import { getTemplateSrv } from '../../templating/template_srv';
import { alignCurrentWithMulti } from '../shared/multiOptions';
import { hasCurrent, hasLegacyVariableSupport, hasOptions, hasStandardVariableSupport, isMulti, isQuery, } from '../guard';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { createErrorNotification } from '../../../core/copy/appNotification';
import { TransactionStatus, variablesClearTransaction, variablesCompleteTransaction, variablesInitTransaction, } from './transactionReducer';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { cleanVariables } from './variablesReducer';
import { ensureStringValues, getCurrentText, getVariableRefresh } from '../utils';
import { store } from 'app/store/store';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { cleanEditorState } from '../editor/reducer';
import { cleanPickerState } from '../pickers/OptionsPicker/reducer';
import { locationService } from '@grafana/runtime';
// process flow queryVariable
// thunk => processVariables
//    adapter => setValueFromUrl
//      thunk => setOptionFromUrl
//        adapter => updateOptions
//          thunk => updateQueryVariableOptions
//            action => updateVariableOptions
//            action => updateVariableTags
//            thunk => validateVariableSelectionState
//              adapter => setValue
//                thunk => setOptionAsCurrent
//                  action => setCurrentVariableValue
//                  thunk => variableUpdated
//                    adapter => updateOptions for dependent nodes
//        adapter => setValue
//          thunk => setOptionAsCurrent
//            action => setCurrentVariableValue
//            thunk => variableUpdated
//              adapter => updateOptions for dependent nodes
//    adapter => updateOptions
//      thunk => updateQueryVariableOptions
//        action => updateVariableOptions
//        action => updateVariableTags
//        thunk => validateVariableSelectionState
//          adapter => setValue
//            thunk => setOptionAsCurrent
//              action => setCurrentVariableValue
//              thunk => variableUpdated
//                adapter => updateOptions for dependent nodes
export var initDashboardTemplating = function (list) {
    return function (dispatch, getState) {
        var orderIndex = 0;
        for (var index = 0; index < list.length; index++) {
            var model = fixSelectedInconsistency(list[index]);
            if (!variableAdapters.getIfExists(model.type)) {
                continue;
            }
            dispatch(addVariable(toVariablePayload(model, { global: false, index: orderIndex++, model: model })));
        }
        getTemplateSrv().updateTimeRange(getTimeSrv().timeRange());
        var variables = getVariables(getState());
        for (var index = 0; index < variables.length; index++) {
            var variable = variables[index];
            dispatch(variableStateNotStarted(toVariablePayload(variable)));
        }
    };
};
export function fixSelectedInconsistency(model) {
    var e_1, _a, e_2, _b;
    if (!hasOptions(model)) {
        return model;
    }
    var found = false;
    try {
        for (var _c = __values(model.options), _d = _c.next(); !_d.done; _d = _c.next()) {
            var option = _d.value;
            option.selected = false;
            if (Array.isArray(model.current.value)) {
                try {
                    for (var _e = (e_2 = void 0, __values(model.current.value)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var value = _f.value;
                        if (option.value === value) {
                            option.selected = found = true;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            else if (option.value === model.current.value) {
                option.selected = found = true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (!found && model.options.length) {
        model.options[0].selected = true;
    }
    return model;
}
export var addSystemTemplateVariables = function (dashboard) {
    return function (dispatch) {
        var dashboardModel = __assign(__assign({}, initialVariableModelState), { id: '__dashboard', name: '__dashboard', type: 'system', index: -3, skipUrlSync: true, hide: VariableHide.hideVariable, current: {
                value: {
                    name: dashboard.title,
                    uid: dashboard.uid,
                    toString: function () { return dashboard.title; },
                },
            } });
        dispatch(addVariable(toVariablePayload(dashboardModel, {
            global: dashboardModel.global,
            index: dashboardModel.index,
            model: dashboardModel,
        })));
        var orgModel = __assign(__assign({}, initialVariableModelState), { id: '__org', name: '__org', type: 'system', index: -2, skipUrlSync: true, hide: VariableHide.hideVariable, current: {
                value: {
                    name: contextSrv.user.orgName,
                    id: contextSrv.user.orgId,
                    toString: function () { return contextSrv.user.orgId.toString(); },
                },
            } });
        dispatch(addVariable(toVariablePayload(orgModel, { global: orgModel.global, index: orgModel.index, model: orgModel })));
        var userModel = __assign(__assign({}, initialVariableModelState), { id: '__user', name: '__user', type: 'system', index: -1, skipUrlSync: true, hide: VariableHide.hideVariable, current: {
                value: {
                    login: contextSrv.user.login,
                    id: contextSrv.user.id,
                    email: contextSrv.user.email,
                    toString: function () { return contextSrv.user.id.toString(); },
                },
            } });
        dispatch(addVariable(toVariablePayload(userModel, { global: userModel.global, index: userModel.index, model: userModel })));
    };
};
export var changeVariableMultiValue = function (identifier, multi) {
    return function (dispatch, getState) {
        var variable = getVariable(identifier.id, getState());
        var current = alignCurrentWithMulti(variable.current, multi);
        dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'multi', propValue: multi })));
        dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'current', propValue: current })));
    };
};
export var processVariableDependencies = function (variable, state) { return __awaiter(void 0, void 0, void 0, function () {
    var dependencies, _a, _b, otherVariable;
    var e_3, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                dependencies = [];
                try {
                    for (_a = __values(getVariables(state)), _b = _a.next(); !_b.done; _b = _a.next()) {
                        otherVariable = _b.value;
                        if (variable === otherVariable) {
                            continue;
                        }
                        if (variableAdapters.getIfExists(variable.type)) {
                            if (variableAdapters.get(variable.type).dependsOn(variable, otherVariable)) {
                                dependencies.push(otherVariable);
                            }
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                if (!isWaitingForDependencies(dependencies, state)) {
                    return [2 /*return*/];
                }
                return [4 /*yield*/, new Promise(function (resolve) {
                        var unsubscribe = store.subscribe(function () {
                            if (!isWaitingForDependencies(dependencies, store.getState())) {
                                unsubscribe();
                                resolve();
                            }
                        });
                    })];
            case 1:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
var isWaitingForDependencies = function (dependencies, state) {
    if (dependencies.length === 0) {
        return false;
    }
    var variables = getVariables(state);
    var notCompletedDependencies = dependencies.filter(function (d) {
        return variables.some(function (v) { return v.id === d.id && (v.state === LoadingState.NotStarted || v.state === LoadingState.Loading); });
    });
    return notCompletedDependencies.length > 0;
};
export var processVariable = function (identifier, queryParams) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variable, urlValue, stringUrlValue, refreshableVariable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variable = getVariable(identifier.id, getState());
                    return [4 /*yield*/, processVariableDependencies(variable, getState())];
                case 1:
                    _a.sent();
                    urlValue = queryParams['var-' + variable.name];
                    if (!(urlValue !== void 0)) return [3 /*break*/, 3];
                    stringUrlValue = ensureStringValues(urlValue);
                    return [4 /*yield*/, variableAdapters.get(variable.type).setValueFromUrl(variable, stringUrlValue)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    if (!variable.hasOwnProperty('refresh')) return [3 /*break*/, 5];
                    refreshableVariable = variable;
                    if (!(refreshableVariable.refresh === VariableRefresh.onDashboardLoad ||
                        refreshableVariable.refresh === VariableRefresh.onTimeRangeChanged)) return [3 /*break*/, 5];
                    return [4 /*yield*/, dispatch(updateOptions(toVariableIdentifier(refreshableVariable)))];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5:
                    // for variables that aren't updated via URL or refresh, let's simulate the same state changes
                    dispatch(completeVariableLoading(identifier));
                    return [2 /*return*/];
            }
        });
    }); };
};
export var processVariables = function () {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var queryParams, promises;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryParams = locationService.getSearchObject();
                    promises = getVariables(getState()).map(function (variable) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, dispatch(processVariable(toVariableIdentifier(variable), queryParams))];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); });
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var setOptionFromUrl = function (identifier, urlValue) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var stringUrlValue, variable, variableFromState, option, defaultText, defaultValue;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stringUrlValue = ensureStringValues(urlValue);
                    variable = getVariable(identifier.id, getState());
                    if (!(getVariableRefresh(variable) !== VariableRefresh.never)) return [3 /*break*/, 2];
                    // updates options
                    return [4 /*yield*/, dispatch(updateOptions(toVariableIdentifier(variable)))];
                case 1:
                    // updates options
                    _a.sent();
                    _a.label = 2;
                case 2:
                    variableFromState = getVariable(variable.id, getState());
                    if (!variableFromState) {
                        throw new Error("Couldn't find variable with name: " + variable.name);
                    }
                    option = variableFromState.options.find(function (op) {
                        return op.text === stringUrlValue || op.value === stringUrlValue;
                    });
                    if (!option && isMulti(variableFromState)) {
                        if (variableFromState.allValue && stringUrlValue === variableFromState.allValue) {
                            option = { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false };
                        }
                    }
                    if (!option) {
                        defaultText = stringUrlValue;
                        defaultValue = stringUrlValue;
                        if (Array.isArray(stringUrlValue)) {
                            // Multiple values in the url. We construct text as a list of texts from all matched options.
                            defaultText = stringUrlValue.reduce(function (acc, item) {
                                var foundOption = variableFromState.options.find(function (o) { return o.value === item; });
                                if (!foundOption) {
                                    // @ts-ignore according to strict null errors this can never happen
                                    // TODO: investigate this further or refactor code
                                    return [].concat(acc, [item]);
                                }
                                // @ts-ignore according to strict null errors this can never happen
                                // TODO: investigate this further or refactor code
                                return [].concat(acc, [foundOption.text]);
                            }, []);
                        }
                        // It is possible that we did not match the value to any existing option. In that case the URL value will be
                        // used anyway for both text and value.
                        option = { text: defaultText, value: defaultValue, selected: false };
                    }
                    if (isMulti(variableFromState)) {
                        // In case variable is multiple choice, we cast to array to preserve the same behavior as when selecting
                        // the option directly, which will return even single value in an array.
                        option = alignCurrentWithMulti({ text: castArray(option.text), value: castArray(option.value), selected: false }, variableFromState.multi);
                    }
                    return [4 /*yield*/, variableAdapters.get(variable.type).setValue(variableFromState, option)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var selectOptionsForCurrentValue = function (variable) {
    var i, y, value, option;
    var selected = [];
    for (i = 0; i < variable.options.length; i++) {
        option = __assign({}, variable.options[i]);
        option.selected = false;
        if (Array.isArray(variable.current.value)) {
            for (y = 0; y < variable.current.value.length; y++) {
                value = variable.current.value[y];
                if (option.value === value) {
                    option.selected = true;
                    selected.push(option);
                }
            }
        }
        else if (option.value === variable.current.value) {
            option.selected = true;
            selected.push(option);
        }
    }
    return selected;
};
export var validateVariableSelectionState = function (identifier, defaultValue) {
    return function (dispatch, getState) {
        var _a, _b;
        var variableInState = getVariable(identifier.id, getState());
        var current = variableInState.current || {};
        var setValue = variableAdapters.get(variableInState.type).setValue;
        if (Array.isArray(current.value)) {
            var selected = selectOptionsForCurrentValue(variableInState);
            // if none pick first
            if (selected.length === 0) {
                var option_1 = variableInState.options[0];
                return setValue(variableInState, option_1);
            }
            var option_2 = {
                value: selected.map(function (v) { return v.value; }),
                text: selected.map(function (v) { return v.text; }),
                selected: true,
            };
            return setValue(variableInState, option_2);
        }
        var option = null;
        // 1. find the current value
        var text = getCurrentText(variableInState);
        option = (_a = variableInState.options) === null || _a === void 0 ? void 0 : _a.find(function (v) { return v.text === text; });
        if (option) {
            return setValue(variableInState, option);
        }
        // 2. find the default value
        if (defaultValue) {
            option = (_b = variableInState.options) === null || _b === void 0 ? void 0 : _b.find(function (v) { return v.text === defaultValue; });
            if (option) {
                return setValue(variableInState, option);
            }
        }
        // 3. use the first value
        if (variableInState.options) {
            var option_3 = variableInState.options[0];
            if (option_3) {
                return setValue(variableInState, option_3);
            }
        }
        // 4... give up
        return Promise.resolve();
    };
};
export var setOptionAsCurrent = function (identifier, current, emitChanges) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dispatch(setCurrentVariableValue(toVariablePayload(identifier, { option: current })));
                    return [4 /*yield*/, dispatch(variableUpdated(identifier, emitChanges))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
};
var createGraph = function (variables) {
    var g = new Graph();
    variables.forEach(function (v) {
        g.createNode(v.name);
    });
    variables.forEach(function (v1) {
        variables.forEach(function (v2) {
            if (v1 === v2) {
                return;
            }
            if (variableAdapters.get(v1.type).dependsOn(v1, v2)) {
                g.link(v1.name, v2.name);
            }
        });
    });
    return g;
};
export var variableUpdated = function (identifier, emitChangeEvents) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variableInState, variables, g, node, promises;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variableInState = getVariable(identifier.id, getState());
                    if (!(getState().templating.transaction.status === TransactionStatus.Fetching)) return [3 /*break*/, 3];
                    if (!(getVariableRefresh(variableInState) === VariableRefresh.never)) return [3 /*break*/, 2];
                    // for variable types with updates that go the setValueFromUrl path in the update let's make sure their state is set to Done.
                    return [4 /*yield*/, dispatch(upgradeLegacyQueries(toVariableIdentifier(variableInState)))];
                case 1:
                    // for variable types with updates that go the setValueFromUrl path in the update let's make sure their state is set to Done.
                    _a.sent();
                    dispatch(completeVariableLoading(identifier));
                    _a.label = 2;
                case 2: return [2 /*return*/, Promise.resolve()];
                case 3:
                    variables = getVariables(getState());
                    g = createGraph(variables);
                    node = g.getNode(variableInState.name);
                    promises = [];
                    if (node) {
                        promises = node.getOptimizedInputEdges().map(function (e) {
                            var variable = variables.find(function (v) { var _a; return v.name === ((_a = e.inputNode) === null || _a === void 0 ? void 0 : _a.name); });
                            if (!variable) {
                                return Promise.resolve();
                            }
                            return dispatch(updateOptions(toVariableIdentifier(variable)));
                        });
                    }
                    return [2 /*return*/, Promise.all(promises).then(function () {
                            if (emitChangeEvents) {
                                var dashboard = getState().dashboard.getModel();
                                dashboard === null || dashboard === void 0 ? void 0 : dashboard.setChangeAffectsAllPanels();
                                dashboard === null || dashboard === void 0 ? void 0 : dashboard.processRepeats();
                                locationService.partial(getQueryWithVariables(getState));
                                dashboard === null || dashboard === void 0 ? void 0 : dashboard.startRefresh();
                            }
                        })];
            }
        });
    }); };
};
export var onTimeRangeUpdated = function (timeRange, dependencies) {
    if (dependencies === void 0) { dependencies = { templateSrv: getTemplateSrv() }; }
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variablesThatNeedRefresh, promises, dashboard, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dependencies.templateSrv.updateTimeRange(timeRange);
                    variablesThatNeedRefresh = getVariables(getState()).filter(function (variable) {
                        if (variable.hasOwnProperty('refresh') && variable.hasOwnProperty('options')) {
                            var variableWithRefresh = variable;
                            return variableWithRefresh.refresh === VariableRefresh.onTimeRangeChanged;
                        }
                        return false;
                    });
                    promises = variablesThatNeedRefresh.map(function (variable) {
                        return dispatch(timeRangeUpdated(toVariableIdentifier(variable)));
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all(promises)];
                case 2:
                    _a.sent();
                    dashboard = getState().dashboard.getModel();
                    dashboard === null || dashboard === void 0 ? void 0 : dashboard.setChangeAffectsAllPanels();
                    dashboard === null || dashboard === void 0 ? void 0 : dashboard.startRefresh();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error(error_1);
                    dispatch(notifyApp(createVariableErrorNotification('Template variable service failed', error_1)));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
};
var timeRangeUpdated = function (identifier) { return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
    var variableInState, previousOptions, updatedVariable, updatedOptions, dashboard;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                variableInState = getVariable(identifier.id);
                previousOptions = variableInState.options.slice();
                return [4 /*yield*/, dispatch(updateOptions(toVariableIdentifier(variableInState), true))];
            case 1:
                _a.sent();
                updatedVariable = getVariable(identifier.id, getState());
                updatedOptions = updatedVariable.options;
                if (angular.toJson(previousOptions) !== angular.toJson(updatedOptions)) {
                    dashboard = getState().dashboard.getModel();
                    dashboard === null || dashboard === void 0 ? void 0 : dashboard.templateVariableValueUpdated();
                }
                return [2 /*return*/];
        }
    });
}); }; };
export var templateVarsChangedInUrl = function (vars) { return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
    var update, dashboard, _loop_1, _a, _b, variable;
    var e_4, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                update = [];
                dashboard = getState().dashboard.getModel();
                _loop_1 = function (variable) {
                    var key = "var-" + variable.name;
                    if (!vars.hasOwnProperty(key)) {
                        return "continue";
                    }
                    if (!isVariableUrlValueDifferentFromCurrent(variable, vars[key].value)) {
                        return "continue";
                    }
                    var value = vars[key].value; // as the default the value is set to the value passed into templateVarsChangedInUrl
                    if (vars[key].removed) {
                        // for some reason (panel|data link without variable) the variable url value (var-xyz) has been removed from the url
                        // so we need to revert the value to the value stored in dashboard json
                        var variableInModel = dashboard === null || dashboard === void 0 ? void 0 : dashboard.templating.list.find(function (v) { return v.name === variable.name; });
                        if (variableInModel && hasCurrent(variableInModel)) {
                            value = variableInModel.current.value; // revert value to the value stored in dashboard json
                        }
                    }
                    var promise = variableAdapters.get(variable.type).setValueFromUrl(variable, value);
                    update.push(promise);
                };
                try {
                    for (_a = __values(getVariables(getState())), _b = _a.next(); !_b.done; _b = _a.next()) {
                        variable = _b.value;
                        _loop_1(variable);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
                if (!update.length) return [3 /*break*/, 2];
                return [4 /*yield*/, Promise.all(update)];
            case 1:
                _d.sent();
                dashboard === null || dashboard === void 0 ? void 0 : dashboard.templateVariableValueUpdated();
                dashboard === null || dashboard === void 0 ? void 0 : dashboard.startRefresh();
                _d.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); }; };
export function isVariableUrlValueDifferentFromCurrent(variable, urlValue) {
    var variableValue = variableAdapters.get(variable.type).getValueForUrl(variable);
    var stringUrlValue = ensureStringValues(urlValue);
    if (Array.isArray(variableValue) && !Array.isArray(stringUrlValue)) {
        stringUrlValue = [stringUrlValue];
    }
    // lodash isEqual handles array of value equality checks as well
    return !isEqual(variableValue, stringUrlValue);
}
var getQueryWithVariables = function (getState) {
    var e_5, _a;
    var queryParams = locationService.getSearchObject();
    var queryParamsNew = Object.keys(queryParams)
        .filter(function (key) { return key.indexOf('var-') === -1; })
        .reduce(function (obj, key) {
        obj[key] = queryParams[key];
        return obj;
    }, {});
    try {
        for (var _b = __values(getVariables(getState())), _c = _b.next(); !_c.done; _c = _b.next()) {
            var variable = _c.value;
            if (variable.skipUrlSync) {
                continue;
            }
            var adapter = variableAdapters.get(variable.type);
            queryParamsNew['var-' + variable.name] = adapter.getValueForUrl(variable);
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return queryParamsNew;
};
export var initVariablesTransaction = function (dashboardUid, dashboard) { return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
    var transactionState, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                transactionState = getState().templating.transaction;
                if (transactionState.status === TransactionStatus.Fetching) {
                    // previous dashboard is still fetching variables, cancel all requests
                    dispatch(cancelVariables());
                }
                // Start init transaction
                dispatch(variablesInitTransaction({ uid: dashboardUid }));
                // Add system variables like __dashboard and __user
                dispatch(addSystemTemplateVariables(dashboard));
                // Load all variables into redux store
                dispatch(initDashboardTemplating(dashboard.templating.list));
                // Process all variable updates
                return [4 /*yield*/, dispatch(processVariables())];
            case 1:
                // Process all variable updates
                _a.sent();
                // Mark update as complete
                dispatch(variablesCompleteTransaction({ uid: dashboardUid }));
                return [3 /*break*/, 3];
            case 2:
                err_1 = _a.sent();
                dispatch(notifyApp(createVariableErrorNotification('Templating init failed', err_1)));
                console.error(err_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); }; };
export var cleanUpVariables = function () { return function (dispatch) {
    dispatch(cleanVariables());
    dispatch(cleanEditorState());
    dispatch(cleanPickerState());
    dispatch(variablesClearTransaction());
}; };
export var cancelVariables = function (dependencies) {
    if (dependencies === void 0) { dependencies = { getBackendSrv: getBackendSrv }; }
    return function (dispatch) {
        dependencies.getBackendSrv().cancelAllInFlightRequests();
        dispatch(cleanUpVariables());
    };
};
export var updateOptions = function (identifier, rethrow) {
    if (rethrow === void 0) { rethrow = false; }
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variableInState, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variableInState = getVariable(identifier.id, getState());
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    dispatch(variableStateFetching(toVariablePayload(variableInState)));
                    return [4 /*yield*/, dispatch(upgradeLegacyQueries(toVariableIdentifier(variableInState)))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, variableAdapters.get(variableInState.type).updateOptions(variableInState)];
                case 3:
                    _a.sent();
                    dispatch(completeVariableLoading(identifier));
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    dispatch(variableStateFailed(toVariablePayload(variableInState, { error: error_2 })));
                    if (!rethrow) {
                        console.error(error_2);
                        dispatch(notifyApp(createVariableErrorNotification('Error updating options:', error_2, identifier)));
                    }
                    if (rethrow) {
                        throw error_2;
                    }
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
};
export var createVariableErrorNotification = function (message, error, identifier) {
    return createErrorNotification("" + (identifier ? "Templating [" + identifier.id + "]" : 'Templating'), message + " " + error.message);
};
export var completeVariableLoading = function (identifier) { return function (dispatch, getState) {
    var variableInState = getVariable(identifier.id, getState());
    if (variableInState.state !== LoadingState.Done) {
        dispatch(variableStateCompleted(toVariablePayload(variableInState)));
    }
}; };
export function upgradeLegacyQueries(identifier, getDatasourceSrvFunc) {
    if (getDatasourceSrvFunc === void 0) { getDatasourceSrvFunc = getDatasourceSrv; }
    return function (dispatch, getState) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var variable, datasource, query, err_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        variable = getVariable(identifier.id, getState());
                        if (!isQuery(variable)) {
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, getDatasourceSrvFunc().get((_a = variable.datasource) !== null && _a !== void 0 ? _a : '')];
                    case 2:
                        datasource = _b.sent();
                        if (hasLegacyVariableSupport(datasource)) {
                            return [2 /*return*/];
                        }
                        if (!hasStandardVariableSupport(datasource)) {
                            return [2 /*return*/];
                        }
                        if (isDataQueryType(variable.query)) {
                            return [2 /*return*/];
                        }
                        query = {
                            refId: datasource.name + "-" + identifier.id + "-Variable-Query",
                            query: variable.query,
                        };
                        dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _b.sent();
                        dispatch(notifyApp(createVariableErrorNotification('Failed to upgrade legacy queries', err_2)));
                        console.error(err_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
}
function isDataQueryType(query) {
    if (!query) {
        return false;
    }
    return query.hasOwnProperty('refId') && typeof query.refId === 'string';
}
//# sourceMappingURL=actions.js.map
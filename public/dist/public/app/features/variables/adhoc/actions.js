import { __assign, __awaiter, __generator } from "tslib";
import { cloneDeep } from 'lodash';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { getNewVariabelIndex, getVariable } from '../state/selectors';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { filterAdded, filterRemoved, filtersRestored, filterUpdated, initialAdHocVariableModelState, } from './reducer';
import { variableUpdated } from '../state/actions';
import { isAdHoc } from '../guard';
var filterTableName = 'Filters';
export var applyFilterFromTable = function (options) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variable, index, value, key, operator, filter_1, filter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variable = getVariableByOptions(options, getState());
                    console.log('getVariableByOptions', options, getState().templating.variables);
                    if (!variable) {
                        dispatch(createAdHocVariable(options));
                        variable = getVariableByOptions(options, getState());
                    }
                    index = variable.filters.findIndex(function (f) { return f.key === options.key && f.value === options.value; });
                    if (!(index === -1)) return [3 /*break*/, 2];
                    value = options.value, key = options.key, operator = options.operator;
                    filter_1 = { value: value, key: key, operator: operator, condition: '' };
                    return [4 /*yield*/, dispatch(addFilter(variable.id, filter_1))];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    filter = __assign(__assign({}, variable.filters[index]), { operator: options.operator });
                    return [4 /*yield*/, dispatch(changeFilter(variable.id, { index: index, filter: filter }))];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
};
export var changeFilter = function (id, update) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variable = getVariable(id, getState());
                    dispatch(filterUpdated(toVariablePayload(variable, update)));
                    return [4 /*yield*/, dispatch(variableUpdated(toVariableIdentifier(variable), true))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var removeFilter = function (id, index) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variable = getVariable(id, getState());
                    dispatch(filterRemoved(toVariablePayload(variable, index)));
                    return [4 /*yield*/, dispatch(variableUpdated(toVariableIdentifier(variable), true))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var addFilter = function (id, filter) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variable = getVariable(id, getState());
                    dispatch(filterAdded(toVariablePayload(variable, filter)));
                    return [4 /*yield*/, dispatch(variableUpdated(toVariableIdentifier(variable), true))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var setFiltersFromUrl = function (id, filters) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variable;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    variable = getVariable(id, getState());
                    dispatch(filtersRestored(toVariablePayload(variable, filters)));
                    return [4 /*yield*/, dispatch(variableUpdated(toVariableIdentifier(variable), true))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var changeVariableDatasource = function (datasource) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var editor, variable, loadingText, ds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    editor = getState().templating.editor;
                    variable = getVariable(editor.id, getState());
                    loadingText = 'Ad hoc filters are applied automatically to all queries that target this data source';
                    dispatch(changeVariableEditorExtended({
                        propName: 'infoText',
                        propValue: loadingText,
                    }));
                    dispatch(changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource })));
                    return [4 /*yield*/, getDatasourceSrv().get(datasource)];
                case 1:
                    ds = _a.sent();
                    if (!ds || !ds.getTagKeys) {
                        dispatch(changeVariableEditorExtended({
                            propName: 'infoText',
                            propValue: 'This data source does not support ad hoc filters yet.',
                        }));
                    }
                    return [2 /*return*/];
            }
        });
    }); };
};
export var initAdHocVariableEditor = function () { return function (dispatch) {
    var dataSources = getDatasourceSrv().getMetricSources();
    var selectable = dataSources.reduce(function (all, ds) {
        if (ds.meta.mixed) {
            return all;
        }
        var text = ds.value === null ? ds.name + " (default)" : ds.name;
        all.push({ text: text, value: ds.value });
        return all;
    }, [{ text: '', value: '' }]);
    dispatch(changeVariableEditorExtended({
        propName: 'dataSources',
        propValue: selectable,
    }));
}; };
var createAdHocVariable = function (options) {
    return function (dispatch, getState) {
        var model = __assign(__assign({}, cloneDeep(initialAdHocVariableModelState)), { datasource: options.datasource, name: filterTableName, id: filterTableName });
        var global = false;
        var index = getNewVariabelIndex(getState());
        var identifier = { type: 'adhoc', id: model.id };
        dispatch(addVariable(toVariablePayload(identifier, { global: global, model: model, index: index })));
    };
};
var getVariableByOptions = function (options, state) {
    return Object.values(state.templating.variables).find(function (v) { var _a; return isAdHoc(v) && ((_a = v.datasource) === null || _a === void 0 ? void 0 : _a.uid) === options.datasource.uid; });
};
//# sourceMappingURL=actions.js.map
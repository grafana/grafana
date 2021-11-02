import { __awaiter, __generator } from "tslib";
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { updateOptions } from '../state/actions';
import { getVariable } from '../state/selectors';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError, } from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { getVariableQueryEditor } from '../editor/getVariableQueryEditor';
import { Subscription } from 'rxjs';
import { getVariableQueryRunner } from './VariableQueryRunner';
import { variableQueryObserver } from './variableQueryObserver';
export var updateQueryVariableOptions = function (identifier, searchFilter) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variableInState, datasource_1, err_1, error;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    variableInState = getVariable(identifier.id, getState());
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    if (getState().templating.editor.id === variableInState.id) {
                        dispatch(removeVariableEditorError({ errorProp: 'update' }));
                    }
                    return [4 /*yield*/, getDataSourceSrv().get((_a = variableInState.datasource) !== null && _a !== void 0 ? _a : '')];
                case 2:
                    datasource_1 = _b.sent();
                    // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
                    // variable will have the wrong current value as input
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var subscription = new Subscription();
                            var observer = variableQueryObserver(resolve, reject, subscription);
                            var responseSubscription = getVariableQueryRunner().getResponse(identifier).subscribe(observer);
                            subscription.add(responseSubscription);
                            getVariableQueryRunner().queueRequest({ identifier: identifier, datasource: datasource_1, searchFilter: searchFilter });
                        })];
                case 3:
                    // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
                    // variable will have the wrong current value as input
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _b.sent();
                    error = toDataQueryError(err_1);
                    if (getState().templating.editor.id === variableInState.id) {
                        dispatch(addVariableEditorError({ errorProp: 'update', errorText: error.message }));
                    }
                    throw error;
                case 5: return [2 /*return*/];
            }
        });
    }); };
};
export var initQueryVariableEditor = function (identifier) { return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
    var variable;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                variable = getVariable(identifier.id, getState());
                return [4 /*yield*/, dispatch(changeQueryVariableDataSource(toVariableIdentifier(variable), variable.datasource))];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }; };
export var changeQueryVariableDataSource = function (identifier, name) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var editorState, previousDatasource, dataSource, VariableQueryEditor, err_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    editorState = getState().templating.editor;
                    previousDatasource = (_a = editorState.extended) === null || _a === void 0 ? void 0 : _a.dataSource;
                    return [4 /*yield*/, getDataSourceSrv().get(name !== null && name !== void 0 ? name : '')];
                case 1:
                    dataSource = _b.sent();
                    if (previousDatasource && previousDatasource.type !== (dataSource === null || dataSource === void 0 ? void 0 : dataSource.type)) {
                        dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: '' })));
                    }
                    dispatch(changeVariableEditorExtended({ propName: 'dataSource', propValue: dataSource }));
                    return [4 /*yield*/, getVariableQueryEditor(dataSource)];
                case 2:
                    VariableQueryEditor = _b.sent();
                    dispatch(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor }));
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _b.sent();
                    console.error(err_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
};
export var changeQueryVariableQuery = function (identifier, query, definition) { return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
    var variableInState, errorText;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                variableInState = getVariable(identifier.id, getState());
                if (hasSelfReferencingQuery(variableInState.name, query)) {
                    errorText = 'Query cannot contain a reference to itself. Variable: $' + variableInState.name;
                    dispatch(addVariableEditorError({ errorProp: 'query', errorText: errorText }));
                    return [2 /*return*/];
                }
                dispatch(removeVariableEditorError({ errorProp: 'query' }));
                dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));
                if (definition) {
                    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: definition })));
                }
                else if (typeof query === 'string') {
                    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: query })));
                }
                return [4 /*yield*/, dispatch(updateOptions(identifier))];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }; };
export function hasSelfReferencingQuery(name, query) {
    if (typeof query === 'string' && query.match(new RegExp('\\$' + name + '(/| |$)'))) {
        return true;
    }
    var flattened = flattenQuery(query);
    for (var prop in flattened) {
        if (flattened.hasOwnProperty(prop)) {
            var value = flattened[prop];
            if (typeof value === 'string' && value.match(new RegExp('\\$' + name + '(/| |$)'))) {
                return true;
            }
        }
    }
    return false;
}
/*
 * Function that takes any object and flattens all props into one level deep object
 * */
export function flattenQuery(query) {
    if (typeof query !== 'object') {
        return { query: query };
    }
    var keys = Object.keys(query);
    var flattened = keys.reduce(function (all, key) {
        var value = query[key];
        if (typeof value !== 'object') {
            all[key] = value;
            return all;
        }
        var result = flattenQuery(value);
        for (var childProp in result) {
            if (result.hasOwnProperty(childProp)) {
                all[key + "_" + childProp] = result[childProp];
            }
        }
        return all;
    }, {});
    return flattened;
}
//# sourceMappingURL=actions.js.map
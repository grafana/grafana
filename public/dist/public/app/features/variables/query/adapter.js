import { __assign, __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { VariableRefresh } from '../types';
import { initialQueryVariableModelState, queryVariableReducer } from './reducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { QueryVariableEditor } from './QueryVariableEditor';
import { updateQueryVariableOptions } from './actions';
import { ALL_VARIABLE_TEXT, toVariableIdentifier } from '../state/types';
import { containsVariable, isAllVariable } from '../utils';
import { optionPickerFactory } from '../pickers';
export var createQueryVariableAdapter = function () {
    return {
        id: 'query',
        description: 'Variable values are fetched from a datasource query',
        name: 'Query',
        initialState: initialQueryVariableModelState,
        reducer: queryVariableReducer,
        picker: optionPickerFactory(),
        editor: QueryVariableEditor,
        dependsOn: function (variable, variableToTest) {
            return containsVariable(variable.query, variable.datasource, variable.regex, variableToTest.name);
        },
        setValue: function (variable, option, emitChanges) {
            if (emitChanges === void 0) { emitChanges = false; }
            return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, dispatch(setOptionAsCurrent(toVariableIdentifier(variable), option, emitChanges))];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        setValueFromUrl: function (variable, urlValue) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        updateOptions: function (variable, searchFilter) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(updateQueryVariableOptions(toVariableIdentifier(variable), searchFilter))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        getSaveModel: function (variable) {
            var _a = cloneDeep(variable), index = _a.index, id = _a.id, state = _a.state, global = _a.global, queryValue = _a.queryValue, rest = __rest(_a, ["index", "id", "state", "global", "queryValue"]);
            // remove options
            if (variable.refresh !== VariableRefresh.never) {
                return __assign(__assign({}, rest), { options: [] });
            }
            return rest;
        },
        getValueForUrl: function (variable) {
            if (isAllVariable(variable)) {
                return ALL_VARIABLE_TEXT;
            }
            return variable.current.value;
        },
    };
};
//# sourceMappingURL=adapter.js.map
import { __assign, __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { dataSourceVariableReducer, initialDataSourceVariableModelState } from './reducer';
import { ALL_VARIABLE_TEXT, toVariableIdentifier } from '../state/types';
import { DataSourceVariableEditor } from './DataSourceVariableEditor';
import { updateDataSourceVariableOptions } from './actions';
import { containsVariable, isAllVariable } from '../utils';
import { optionPickerFactory } from '../pickers';
export var createDataSourceVariableAdapter = function () {
    return {
        id: 'datasource',
        description: 'Enabled you to dynamically switch the data source for multiple panels.',
        name: 'Data source',
        initialState: initialDataSourceVariableModelState,
        reducer: dataSourceVariableReducer,
        picker: optionPickerFactory(),
        editor: DataSourceVariableEditor,
        dependsOn: function (variable, variableToTest) {
            if (variable.regex) {
                return containsVariable(variable.regex, variableToTest.name);
            }
            return false;
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
        updateOptions: function (variable) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(updateDataSourceVariableOptions(toVariableIdentifier(variable)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        getSaveModel: function (variable) {
            var _a = cloneDeep(variable), index = _a.index, id = _a.id, state = _a.state, global = _a.global, rest = __rest(_a, ["index", "id", "state", "global"]);
            return __assign(__assign({}, rest), { options: [] });
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
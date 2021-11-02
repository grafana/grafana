import { __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { customVariableReducer, initialCustomVariableModelState } from './reducer';
import { CustomVariableEditor } from './CustomVariableEditor';
import { updateCustomVariableOptions } from './actions';
import { ALL_VARIABLE_TEXT, toVariableIdentifier } from '../state/types';
import { isAllVariable } from '../utils';
import { optionPickerFactory } from '../pickers';
export var createCustomVariableAdapter = function () {
    return {
        id: 'custom',
        description: 'Define variable values manually',
        name: 'Custom',
        initialState: initialCustomVariableModelState,
        reducer: customVariableReducer,
        picker: optionPickerFactory(),
        editor: CustomVariableEditor,
        dependsOn: function () {
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
                    case 0: return [4 /*yield*/, dispatch(updateCustomVariableOptions(toVariableIdentifier(variable)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        getSaveModel: function (variable) {
            var _a = cloneDeep(variable), index = _a.index, id = _a.id, state = _a.state, global = _a.global, rest = __rest(_a, ["index", "id", "state", "global"]);
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
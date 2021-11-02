import { __assign, __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { initialTextBoxVariableModelState, textBoxVariableReducer } from './reducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent } from '../state/actions';
import { TextBoxVariablePicker } from './TextBoxVariablePicker';
import { TextBoxVariableEditor } from './TextBoxVariableEditor';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { toVariableIdentifier } from '../state/types';
export var createTextBoxVariableAdapter = function () {
    return {
        id: 'textbox',
        description: 'Define a textbox variable, where users can enter any arbitrary string',
        name: 'Text box',
        initialState: initialTextBoxVariableModelState,
        reducer: textBoxVariableReducer,
        picker: TextBoxVariablePicker,
        editor: TextBoxVariableEditor,
        dependsOn: function (variable, variableToTest) {
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
                    case 0: return [4 /*yield*/, dispatch(setTextBoxVariableOptionsFromUrl(toVariableIdentifier(variable), urlValue))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        updateOptions: function (variable) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(updateTextBoxVariableOptions(toVariableIdentifier(variable)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        getSaveModel: function (variable, saveCurrentAsDefault) {
            var _a = cloneDeep(variable), index = _a.index, id = _a.id, state = _a.state, global = _a.global, originalQuery = _a.originalQuery, rest = __rest(_a, ["index", "id", "state", "global", "originalQuery"]);
            if (variable.query !== originalQuery && !saveCurrentAsDefault) {
                var origQuery = originalQuery !== null && originalQuery !== void 0 ? originalQuery : '';
                var current = { selected: false, text: origQuery, value: origQuery };
                return __assign(__assign({}, rest), { query: origQuery, current: current, options: [current] });
            }
            return rest;
        },
        getValueForUrl: function (variable) {
            return variable.current.value;
        },
        beforeAdding: function (model) {
            return __assign(__assign({}, cloneDeep(model)), { originalQuery: model.query });
        },
    };
};
//# sourceMappingURL=adapter.js.map
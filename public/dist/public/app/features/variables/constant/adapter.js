import { __assign, __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { constantVariableReducer, initialConstantVariableModelState } from './reducer';
import { ConstantVariableEditor } from './ConstantVariableEditor';
import { updateConstantVariableOptions } from './actions';
import { toVariableIdentifier } from '../state/types';
import { optionPickerFactory } from '../pickers';
export var createConstantVariableAdapter = function () {
    return {
        id: 'constant',
        description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share.',
        name: 'Constant',
        initialState: initialConstantVariableModelState,
        reducer: constantVariableReducer,
        picker: optionPickerFactory(),
        editor: ConstantVariableEditor,
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
                    case 0: return [4 /*yield*/, dispatch(updateConstantVariableOptions(toVariableIdentifier(variable)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        getSaveModel: function (variable) {
            var _a = cloneDeep(variable), index = _a.index, id = _a.id, state = _a.state, global = _a.global, current = _a.current, options = _a.options, rest = __rest(_a, ["index", "id", "state", "global", "current", "options"]);
            return rest;
        },
        getValueForUrl: function (variable) {
            return variable.current.value;
        },
        beforeAdding: function (model) {
            var _a = cloneDeep(model), current = _a.current, options = _a.options, query = _a.query, rest = __rest(_a, ["current", "options", "query"]);
            var option = { selected: true, text: query, value: query };
            return __assign(__assign({}, rest), { current: option, options: [option], query: query });
        },
    };
};
//# sourceMappingURL=adapter.js.map
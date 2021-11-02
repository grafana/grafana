import { __assign, __awaiter, __generator } from "tslib";
import { LoadingState } from '@grafana/data';
import { initialVariableModelState, VariableHide } from '../types';
export var createSystemVariableAdapter = function () {
    return {
        id: 'system',
        description: '',
        name: 'system',
        initialState: __assign(__assign({}, initialVariableModelState), { type: 'system', hide: VariableHide.hideVariable, skipUrlSync: true, current: { value: { toString: function () { return ''; } } }, state: LoadingState.Done }),
        reducer: function (state, action) { return state; },
        picker: null,
        editor: null,
        dependsOn: function () {
            return false;
        },
        setValue: function (variable, option, emitChanges) {
            if (emitChanges === void 0) { emitChanges = false; }
            return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/];
                });
            });
        },
        setValueFromUrl: function (variable, urlValue) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        }); },
        updateOptions: function (variable) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        }); },
        getSaveModel: function (variable) {
            return {};
        },
        getValueForUrl: function (variable) {
            return '';
        },
    };
};
//# sourceMappingURL=adapter.js.map
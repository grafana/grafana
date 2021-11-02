import { __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { initialIntervalVariableModelState, intervalVariableReducer } from './reducer';
import { toVariableIdentifier } from '../state/types';
import { IntervalVariableEditor } from './IntervalVariableEditor';
import { updateAutoValue, updateIntervalVariableOptions } from './actions';
import { optionPickerFactory } from '../pickers';
export var createIntervalVariableAdapter = function () {
    return {
        id: 'interval',
        description: 'Define a timespan interval (ex 1m, 1h, 1d)',
        name: 'Interval',
        initialState: initialIntervalVariableModelState,
        reducer: intervalVariableReducer,
        picker: optionPickerFactory(),
        editor: IntervalVariableEditor,
        dependsOn: function () {
            return false;
        },
        setValue: function (variable, option, emitChanges) {
            if (emitChanges === void 0) { emitChanges = false; }
            return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, dispatch(updateAutoValue(toVariableIdentifier(variable)))];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, dispatch(setOptionAsCurrent(toVariableIdentifier(variable), option, emitChanges))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        setValueFromUrl: function (variable, urlValue) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(updateAutoValue(toVariableIdentifier(variable)))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        updateOptions: function (variable) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(updateIntervalVariableOptions(toVariableIdentifier(variable)))];
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
            return variable.current.value;
        },
    };
};
//# sourceMappingURL=adapter.js.map
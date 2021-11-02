import { __awaiter, __generator, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { AdHocPicker } from './picker/AdHocPicker';
import { adHocVariableReducer, initialAdHocVariableModelState } from './reducer';
import { AdHocVariableEditor } from './AdHocVariableEditor';
import { setFiltersFromUrl } from './actions';
import * as urlParser from './urlParser';
var noop = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/];
}); }); };
export var createAdHocVariableAdapter = function () {
    return {
        id: 'adhoc',
        description: 'Add key/value filters on the fly.',
        name: 'Ad hoc filters',
        initialState: initialAdHocVariableModelState,
        reducer: adHocVariableReducer,
        picker: AdHocPicker,
        editor: AdHocVariableEditor,
        dependsOn: function () { return false; },
        setValue: noop,
        setValueFromUrl: function (variable, urlValue) { return __awaiter(void 0, void 0, void 0, function () {
            var filters;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        filters = urlParser.toFilters(urlValue);
                        return [4 /*yield*/, dispatch(setFiltersFromUrl(variable.id, filters))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        updateOptions: noop,
        getSaveModel: function (variable) {
            var _a = cloneDeep(variable), index = _a.index, id = _a.id, state = _a.state, global = _a.global, rest = __rest(_a, ["index", "id", "state", "global"]);
            return rest;
        },
        getValueForUrl: function (variable) {
            var _a;
            var filters = (_a = variable === null || variable === void 0 ? void 0 : variable.filters) !== null && _a !== void 0 ? _a : [];
            return urlParser.toUrl(filters);
        },
    };
};
//# sourceMappingURL=adapter.js.map
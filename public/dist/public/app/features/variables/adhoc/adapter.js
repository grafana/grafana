import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { toKeyedVariableIdentifier } from '../utils';
import { AdHocVariableEditor } from './AdHocVariableEditor';
import { setFiltersFromUrl } from './actions';
import { AdHocPicker } from './picker/AdHocPicker';
import { adHocVariableReducer, initialAdHocVariableModelState } from './reducer';
import * as urlParser from './urlParser';
const noop = () => __awaiter(void 0, void 0, void 0, function* () { });
export const createAdHocVariableAdapter = () => {
    return {
        id: 'adhoc',
        description: 'Add key/value filters on the fly.',
        name: 'Ad hoc filters',
        initialState: initialAdHocVariableModelState,
        reducer: adHocVariableReducer,
        picker: AdHocPicker,
        editor: AdHocVariableEditor,
        dependsOn: () => false,
        setValue: noop,
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            const filters = urlParser.toFilters(urlValue);
            yield dispatch(setFiltersFromUrl(toKeyedVariableIdentifier(variable), filters));
        }),
        updateOptions: noop,
        getSaveModel: (variable) => {
            const _a = cloneDeep(variable), { index, id, state, global, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "rootStateKey"]);
            return rest;
        },
        getValueForUrl: (variable) => {
            var _a;
            const filters = (_a = variable === null || variable === void 0 ? void 0 : variable.filters) !== null && _a !== void 0 ? _a : [];
            return urlParser.toUrl(filters);
        },
    };
};
//# sourceMappingURL=adapter.js.map
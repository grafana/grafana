import { __awaiter } from "tslib";
import { LoadingState } from '@grafana/data';
import { initialVariableModelState, VariableHide } from '../types';
export const createSystemVariableAdapter = () => {
    return {
        id: 'system',
        description: '',
        name: 'system',
        initialState: Object.assign(Object.assign({}, initialVariableModelState), { type: 'system', hide: VariableHide.hideVariable, skipUrlSync: true, current: { value: { toString: () => '' } }, state: LoadingState.Done }),
        reducer: (state, action) => state,
        picker: null,
        editor: null,
        dependsOn: () => {
            return false;
        },
        setValue: (variable, option, emitChanges = false) => __awaiter(void 0, void 0, void 0, function* () {
            return;
        }),
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            return;
        }),
        updateOptions: (variable) => __awaiter(void 0, void 0, void 0, function* () {
            return;
        }),
        getSaveModel: (variable) => {
            return {};
        },
        getValueForUrl: (variable) => {
            return '';
        },
    };
};
//# sourceMappingURL=adapter.js.map
import { LoadingState, VariableHide } from '@grafana/data';
export function makeVariable(id, name, attributes) {
    return Object.assign(Object.assign({ multi: false, type: 'custom', includeAll: false, current: {}, options: [], query: '', rootStateKey: null, global: false, hide: VariableHide.dontHide, skipUrlSync: false, index: -1, state: LoadingState.NotStarted, error: null, description: null }, attributes), { id,
        name });
}
//# sourceMappingURL=testHelpers.js.map
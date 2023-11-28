import { initialKeyedVariablesState } from 'app/features/variables/state/keyedVariablesReducer';
import { useDispatch } from 'app/types';
export let store;
export function setStore(newStore) {
    store = newStore;
}
export function getState() {
    if (!store || !store.getState) {
        return { templating: Object.assign(Object.assign({}, initialKeyedVariablesState), { lastKey: 'key' }) }; // used by tests
    }
    return store.getState();
}
export function dispatch(action) {
    if (!store || !store.getState) {
        return;
    }
    return store.dispatch(action);
}
// @PERCONA
export const useAppDispatch = () => useDispatch();
//# sourceMappingURL=store.js.map
import { toStateKey } from '../utils';
import { getTemplatingReducers } from './reducers';
import { variablesInitTransaction } from './transactionReducer';
export const initialKeyedVariablesState = { keys: {} };
const keyedAction = (payload) => ({
    type: `templating/keyed/${payload.action.type.replace(/^templating\//, '')}`,
    payload,
});
export function toKeyedAction(key, action) {
    const keyAsString = toStateKey(key);
    return keyedAction({ key: keyAsString, action });
}
const isKeyedAction = (action) => {
    return (typeof action.type === 'string' &&
        action.type.startsWith('templating/keyed') &&
        'payload' in action &&
        typeof action.payload.key === 'string');
};
export function keyedVariablesReducer(state = initialKeyedVariablesState, outerAction) {
    if (isKeyedAction(outerAction)) {
        const { key, action } = outerAction.payload;
        const stringKey = toStateKey(key);
        const lastKey = variablesInitTransaction.match(action) ? stringKey : state.lastKey;
        const templatingReducers = getTemplatingReducers();
        const prevKeyState = state.keys[stringKey];
        const nextKeyState = templatingReducers(prevKeyState, action);
        return Object.assign(Object.assign({}, state), { lastKey, keys: Object.assign(Object.assign({}, state.keys), { [stringKey]: nextKeyState }) });
    }
    return state;
}
export default {
    templating: keyedVariablesReducer,
};
//# sourceMappingURL=keyedVariablesReducer.js.map
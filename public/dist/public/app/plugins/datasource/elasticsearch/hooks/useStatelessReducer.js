import { createContext, useCallback, useContext } from 'react';
export const combineReducers = (reducers) => (state, action) => {
    const newState = {};
    for (const key in reducers) {
        newState[key] = reducers[key](state[key], action);
    }
    return newState;
};
export const useStatelessReducer = (onChange, state, reducer) => {
    const dispatch = useCallback((action) => {
        onChange(reducer(state, action));
    }, [onChange, state, reducer]);
    return dispatch;
};
export const DispatchContext = createContext(undefined);
export const useDispatch = () => {
    const dispatch = useContext(DispatchContext);
    if (!dispatch) {
        throw new Error('Use DispatchContext first.');
    }
    return dispatch;
};
//# sourceMappingURL=useStatelessReducer.js.map
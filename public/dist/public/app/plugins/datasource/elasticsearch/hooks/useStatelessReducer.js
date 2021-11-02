import { createContext, useCallback, useContext } from 'react';
export var combineReducers = function (reducers) { return function (state, action) {
    var newState = {};
    for (var key in reducers) {
        newState[key] = reducers[key](state[key], action);
    }
    return newState;
}; };
export var useStatelessReducer = function (onChange, state, reducer) {
    var dispatch = useCallback(function (action) {
        onChange(reducer(state, action));
    }, [onChange, state, reducer]);
    return dispatch;
};
export var DispatchContext = createContext(undefined);
export var useDispatch = function () {
    var dispatch = useContext(DispatchContext);
    if (!dispatch) {
        throw new Error('Use DispatchContext first.');
    }
    return dispatch;
};
//# sourceMappingURL=useStatelessReducer.js.map
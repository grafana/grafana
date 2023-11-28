import { cloneDeep } from 'lodash';
export const deepFreeze = (obj) => {
    Object.freeze(obj);
    const isNotException = (object, propertyName) => typeof object === 'function'
        ? propertyName !== 'caller' && propertyName !== 'callee' && propertyName !== 'arguments'
        : true;
    const hasOwnProp = Object.prototype.hasOwnProperty;
    if (obj && obj instanceof Object) {
        const object = obj;
        Object.getOwnPropertyNames(object).forEach((propertyName) => {
            const objectProperty = object[propertyName];
            if (hasOwnProp.call(object, propertyName) &&
                isNotException(object, propertyName) &&
                objectProperty &&
                (typeof objectProperty === 'object' || typeof objectProperty === 'function') &&
                Object.isFrozen(objectProperty) === false) {
                deepFreeze(objectProperty);
            }
        });
    }
    return obj;
};
export const reducerTester = () => {
    let reducerUnderTest;
    let resultingState;
    let initialState;
    let showDebugOutput = false;
    const givenReducer = (reducer, state, debug = false, disableDeepFreeze = false) => {
        reducerUnderTest = reducer;
        initialState = cloneDeep(state);
        if (!disableDeepFreeze && (typeof state === 'object' || typeof state === 'function')) {
            deepFreeze(initialState);
        }
        showDebugOutput = debug;
        return instance;
    };
    const whenActionIsDispatched = (action) => {
        resultingState = reducerUnderTest(resultingState || initialState, action);
        return instance;
    };
    const thenStateShouldEqual = (state) => {
        if (showDebugOutput) {
            console.log(JSON.stringify(resultingState, null, 2));
        }
        expect(resultingState).toEqual(state);
        return instance;
    };
    const thenStatePredicateShouldEqual = (predicate) => {
        if (showDebugOutput) {
            console.log(JSON.stringify(resultingState, null, 2));
        }
        expect(predicate(resultingState)).toBe(true);
        return instance;
    };
    const instance = {
        thenStateShouldEqual,
        thenStatePredicateShouldEqual,
        givenReducer,
        whenActionIsDispatched,
    };
    return instance;
};
//# sourceMappingURL=reducerTester.js.map
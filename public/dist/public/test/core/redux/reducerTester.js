import { cloneDeep } from 'lodash';
export var deepFreeze = function (obj) {
    Object.freeze(obj);
    var isNotException = function (object, propertyName) {
        return typeof object === 'function'
            ? propertyName !== 'caller' && propertyName !== 'callee' && propertyName !== 'arguments'
            : true;
    };
    var hasOwnProp = Object.prototype.hasOwnProperty;
    if (obj && obj instanceof Object) {
        var object_1 = obj;
        Object.getOwnPropertyNames(object_1).forEach(function (propertyName) {
            var objectProperty = object_1[propertyName];
            if (hasOwnProp.call(object_1, propertyName) &&
                isNotException(object_1, propertyName) &&
                objectProperty &&
                (typeof objectProperty === 'object' || typeof objectProperty === 'function') &&
                Object.isFrozen(objectProperty) === false) {
                deepFreeze(objectProperty);
            }
        });
    }
    return obj;
};
export var reducerTester = function () {
    var reducerUnderTest;
    var resultingState;
    var initialState;
    var showDebugOutput = false;
    var givenReducer = function (reducer, state, debug, disableDeepFreeze) {
        if (debug === void 0) { debug = false; }
        if (disableDeepFreeze === void 0) { disableDeepFreeze = false; }
        reducerUnderTest = reducer;
        initialState = cloneDeep(state);
        if (!disableDeepFreeze && (typeof state === 'object' || typeof state === 'function')) {
            deepFreeze(initialState);
        }
        showDebugOutput = debug;
        return instance;
    };
    var whenActionIsDispatched = function (action) {
        resultingState = reducerUnderTest(resultingState || initialState, action);
        return instance;
    };
    var thenStateShouldEqual = function (state) {
        if (showDebugOutput) {
            console.log(JSON.stringify(resultingState, null, 2));
        }
        expect(resultingState).toEqual(state);
        return instance;
    };
    var thenStatePredicateShouldEqual = function (predicate) {
        if (showDebugOutput) {
            console.log(JSON.stringify(resultingState, null, 2));
        }
        expect(predicate(resultingState)).toBe(true);
        return instance;
    };
    var instance = {
        thenStateShouldEqual: thenStateShouldEqual,
        thenStatePredicateShouldEqual: thenStatePredicateShouldEqual,
        givenReducer: givenReducer,
        whenActionIsDispatched: whenActionIsDispatched,
    };
    return instance;
};
//# sourceMappingURL=reducerTester.js.map
import * as tslib_1 from "tslib";
var deepFreeze = function (obj) {
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
    var reducerUnderTest = null;
    var resultingState = null;
    var initialState = null;
    var givenReducer = function (reducer, state) {
        reducerUnderTest = reducer;
        initialState = tslib_1.__assign({}, state);
        initialState = deepFreeze(initialState);
        return instance;
    };
    var whenActionIsDispatched = function (action) {
        resultingState = reducerUnderTest(initialState, action);
        return instance;
    };
    var thenStateShouldEqual = function (state) {
        expect(state).toEqual(resultingState);
        return instance;
    };
    var instance = { thenStateShouldEqual: thenStateShouldEqual, givenReducer: givenReducer, whenActionIsDispatched: whenActionIsDispatched };
    return instance;
};
//# sourceMappingURL=reducerTester.js.map
import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import thunk from 'redux-thunk';
import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import { setStore } from '../../../app/store/store';
export var reduxTester = function (args) {
    var _a, _b;
    var dispatchedActions = [];
    var logActionsMiddleWare = function (store) { return function (next) { return function (action) {
        // filter out thunk actions
        if (action && typeof action !== 'function') {
            dispatchedActions.push(action);
        }
        return next(action);
    }; }; };
    var preloadedState = (_a = args === null || args === void 0 ? void 0 : args.preloadedState) !== null && _a !== void 0 ? _a : {};
    var debug = (_b = args === null || args === void 0 ? void 0 : args.debug) !== null && _b !== void 0 ? _b : false;
    var store = null;
    var defaultMiddleware = getDefaultMiddleware({
        thunk: false,
        serializableCheck: false,
        immutableCheck: false,
    });
    var givenRootReducer = function (rootReducer) {
        store = configureStore({
            reducer: rootReducer,
            middleware: __spreadArray(__spreadArray([], __read(defaultMiddleware), false), [logActionsMiddleWare, thunk], false),
            preloadedState: preloadedState,
        });
        setStore(store);
        return instance;
    };
    var whenActionIsDispatched = function (action, clearPreviousActions) {
        if (clearPreviousActions) {
            dispatchedActions.length = 0;
        }
        if (store === null) {
            throw new Error('Store was not setup properly');
        }
        store.dispatch(action);
        return instance;
    };
    var whenAsyncActionIsDispatched = function (action, clearPreviousActions) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (clearPreviousActions) {
                        dispatchedActions.length = 0;
                    }
                    if (store === null) {
                        throw new Error('Store was not setup properly');
                    }
                    return [4 /*yield*/, store.dispatch(action)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, instance];
            }
        });
    }); };
    var thenDispatchedActionsShouldEqual = function () {
        var actions = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            actions[_i] = arguments[_i];
        }
        if (debug) {
            console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
        }
        if (!actions.length) {
            throw new Error('thenDispatchedActionShouldEqual has to be called with at least one action');
        }
        expect(dispatchedActions).toEqual(actions);
        return instance;
    };
    var thenDispatchedActionsPredicateShouldEqual = function (predicate) {
        if (debug) {
            console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
        }
        expect(predicate(dispatchedActions)).toBe(true);
        return instance;
    };
    var thenNoActionsWhereDispatched = function () {
        if (debug) {
            console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
        }
        expect(dispatchedActions.length).toBe(0);
        return instance;
    };
    var instance = {
        givenRootReducer: givenRootReducer,
        whenActionIsDispatched: whenActionIsDispatched,
        whenAsyncActionIsDispatched: whenAsyncActionIsDispatched,
        thenDispatchedActionsShouldEqual: thenDispatchedActionsShouldEqual,
        thenDispatchedActionsPredicateShouldEqual: thenDispatchedActionsPredicateShouldEqual,
        thenNoActionsWhereDispatched: thenNoActionsWhereDispatched,
    };
    return instance;
};
//# sourceMappingURL=reduxTester.js.map
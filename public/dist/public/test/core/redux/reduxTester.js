import { __awaiter } from "tslib";
import { configureStore, getDefaultMiddleware, } from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { setStore } from '../../../app/store/store';
export const reduxTester = (args) => {
    var _a, _b;
    const dispatchedActions = [];
    const logActionsMiddleWare = (store) => (next) => (action) => {
        // filter out thunk actions
        if (action && typeof action !== 'function') {
            dispatchedActions.push(action);
        }
        return next(action);
    };
    const preloadedState = (_a = args === null || args === void 0 ? void 0 : args.preloadedState) !== null && _a !== void 0 ? _a : {};
    const debug = (_b = args === null || args === void 0 ? void 0 : args.debug) !== null && _b !== void 0 ? _b : false;
    let store = null;
    const defaultMiddleware = getDefaultMiddleware({
        thunk: false,
        serializableCheck: false,
        immutableCheck: false,
    });
    const givenRootReducer = (rootReducer) => {
        store = configureStore({
            reducer: rootReducer,
            middleware: [...defaultMiddleware, logActionsMiddleWare, thunk],
            preloadedState,
        });
        setStore(store);
        return instance;
    };
    const whenActionIsDispatched = (action, clearPreviousActions) => {
        if (clearPreviousActions) {
            dispatchedActions.length = 0;
        }
        if (store === null) {
            throw new Error('Store was not setup properly');
        }
        store.dispatch(action);
        return instance;
    };
    const whenAsyncActionIsDispatched = (action, clearPreviousActions) => __awaiter(void 0, void 0, void 0, function* () {
        if (clearPreviousActions) {
            dispatchedActions.length = 0;
        }
        if (store === null) {
            throw new Error('Store was not setup properly');
        }
        yield store.dispatch(action);
        return instance;
    });
    const thenDispatchedActionsShouldEqual = (...actions) => {
        if (debug) {
            console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
        }
        if (!actions.length) {
            throw new Error('thenDispatchedActionShouldEqual has to be called with at least one action');
        }
        expect(dispatchedActions).toEqual(actions);
        return instance;
    };
    const thenDispatchedActionsPredicateShouldEqual = (predicate) => {
        if (debug) {
            console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
        }
        expect(predicate(dispatchedActions)).toBe(true);
        return instance;
    };
    const thenNoActionsWhereDispatched = () => {
        if (debug) {
            console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
        }
        expect(dispatchedActions.length).toBe(0);
        return instance;
    };
    const instance = {
        givenRootReducer,
        whenActionIsDispatched,
        whenAsyncActionIsDispatched,
        thenDispatchedActionsShouldEqual,
        thenDispatchedActionsPredicateShouldEqual,
        thenNoActionsWhereDispatched,
    };
    return instance;
};
//# sourceMappingURL=reduxTester.js.map
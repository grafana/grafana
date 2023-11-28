import { __awaiter } from "tslib";
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
const mockStore = configureMockStore([thunk]);
export const thunkTester = (initialState, debug) => {
    const store = mockStore(initialState);
    let thunkUnderTest = null;
    let dispatchedActions = [];
    const givenThunk = (thunkFunction) => {
        thunkUnderTest = thunkFunction;
        return instance;
    };
    const whenThunkIsDispatched = (...args) => __awaiter(void 0, void 0, void 0, function* () {
        yield store.dispatch(thunkUnderTest(...args));
        dispatchedActions = store.getActions();
        if (debug) {
            console.log('resultingActions:', JSON.stringify(dispatchedActions, null, 2));
        }
        return dispatchedActions;
    });
    const instance = {
        givenThunk,
        whenThunkIsDispatched,
    };
    return instance;
};
//# sourceMappingURL=thunkTester.js.map
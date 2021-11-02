import { __awaiter, __generator, __read, __spreadArray } from "tslib";
// @ts-ignore
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
var mockStore = configureMockStore([thunk]);
export var thunkTester = function (initialState, debug) {
    var store = mockStore(initialState);
    var thunkUnderTest = null;
    var dispatchedActions = [];
    var givenThunk = function (thunkFunction) {
        thunkUnderTest = thunkFunction;
        return instance;
    };
    var whenThunkIsDispatched = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, store.dispatch(thunkUnderTest.apply(void 0, __spreadArray([], __read(args), false)))];
                    case 1:
                        _a.sent();
                        dispatchedActions = store.getActions();
                        if (debug) {
                            console.log('resultingActions:', JSON.stringify(dispatchedActions, null, 2));
                        }
                        return [2 /*return*/, dispatchedActions];
                }
            });
        });
    };
    var instance = {
        givenThunk: givenThunk,
        whenThunkIsDispatched: whenThunkIsDispatched,
    };
    return instance;
};
//# sourceMappingURL=thunkTester.js.map
import { __assign } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { reducerTester } from './reducerTester';
var initialState = {
    data: [],
};
var dummyAction = createAction('dummyAction');
var mutatingReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    if (dummyAction.match(action)) {
        state.data.push(action.payload);
        return state;
    }
    return state;
};
var okReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    if (dummyAction.match(action)) {
        return __assign(__assign({}, state), { data: state.data.concat(action.payload) });
    }
    return state;
};
describe('reducerTester', function () {
    describe('when reducer mutates state', function () {
        it('then it should throw', function () {
            expect(function () {
                reducerTester()
                    .givenReducer(mutatingReducer, initialState)
                    .whenActionIsDispatched(dummyAction('some string'));
            }).toThrow();
        });
    });
    describe('when reducer does not mutate state', function () {
        it('then it should not throw', function () {
            expect(function () {
                reducerTester()
                    .givenReducer(okReducer, initialState)
                    .whenActionIsDispatched(dummyAction('some string'));
            }).not.toThrow();
        });
    });
});
//# sourceMappingURL=reducerTester.test.js.map
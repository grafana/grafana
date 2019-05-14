import * as tslib_1 from "tslib";
import { reducerFactory, actionCreatorFactory } from 'app/core/redux';
import { reducerTester } from './reducerTester';
var initialState = {
    data: [],
};
var dummyAction = actionCreatorFactory('dummyAction').create();
var mutatingReducer = reducerFactory(initialState)
    .addMapper({
    filter: dummyAction,
    mapper: function (state, action) {
        state.data.push(action.payload);
        return state;
    },
})
    .create();
var okReducer = reducerFactory(initialState)
    .addMapper({
    filter: dummyAction,
    mapper: function (state, action) {
        return tslib_1.__assign({}, state, { data: state.data.concat(action.payload) });
    },
})
    .create();
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
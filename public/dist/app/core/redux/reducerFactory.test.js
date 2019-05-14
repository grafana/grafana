import * as tslib_1 from "tslib";
import { reducerFactory } from './reducerFactory';
import { actionCreatorFactory } from './actionCreatorFactory';
var dummyReducerIntialState = {
    n: 1,
    s: 'One',
    b: true,
    o: {
        n: 2,
        s: 'two',
        b: false,
    },
};
var dummyActionCreator = actionCreatorFactory('dummy').create();
var dummyReducer = reducerFactory(dummyReducerIntialState)
    .addMapper({
    filter: dummyActionCreator,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, action.payload)); },
})
    .create();
describe('reducerFactory', function () {
    describe('given it is created with a defined handler', function () {
        describe('when reducer is called with no state', function () {
            describe('and with an action that the handler can not handle', function () {
                it('then the resulting state should be intial state', function () {
                    var result = dummyReducer(undefined, {});
                    expect(result).toEqual(dummyReducerIntialState);
                });
            });
            describe('and with an action that the handler can handle', function () {
                it('then the resulting state should correct', function () {
                    var payload = { n: 10, s: 'ten', b: false, o: { n: 20, s: 'twenty', b: true } };
                    var result = dummyReducer(undefined, dummyActionCreator(payload));
                    expect(result).toEqual(payload);
                });
            });
        });
        describe('when reducer is called with a state', function () {
            describe('and with an action that the handler can not handle', function () {
                it('then the resulting state should be intial state', function () {
                    var result = dummyReducer(dummyReducerIntialState, {});
                    expect(result).toEqual(dummyReducerIntialState);
                });
            });
            describe('and with an action that the handler can handle', function () {
                it('then the resulting state should correct', function () {
                    var payload = { n: 10, s: 'ten', b: false, o: { n: 20, s: 'twenty', b: true } };
                    var result = dummyReducer(dummyReducerIntialState, dummyActionCreator(payload));
                    expect(result).toEqual(payload);
                });
            });
        });
    });
    describe('given a handler is added', function () {
        describe('when a handler with the same creator is added', function () {
            it('then is should throw', function () {
                var faultyReducer = reducerFactory(dummyReducerIntialState).addMapper({
                    filter: dummyActionCreator,
                    mapper: function (state, action) {
                        return tslib_1.__assign({}, state, action.payload);
                    },
                });
                expect(function () {
                    faultyReducer.addMapper({
                        filter: dummyActionCreator,
                        mapper: function (state) {
                            return state;
                        },
                    });
                }).toThrow();
            });
        });
    });
});
//# sourceMappingURL=reducerFactory.test.js.map
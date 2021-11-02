import { __assign } from "tslib";
import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { useStatelessReducer, useDispatch, DispatchContext, combineReducers } from './useStatelessReducer';
describe('useStatelessReducer Hook', function () {
    it('When dispatch is called, it should call the provided reducer with the correct action and state', function () {
        var action = { type: 'SOME ACTION' };
        var reducer = jest.fn();
        var state = { someProp: 'some state' };
        var result = renderHook(function () { return useStatelessReducer(function () { }, state, reducer); }).result;
        result.current(action);
        expect(reducer).toHaveBeenCalledWith(state, action);
    });
    it('When an action is dispatched, it should call the provided onChange callback with the result from the reducer', function () {
        var action = { type: 'SOME ACTION' };
        var state = { propA: 'A', propB: 'B' };
        var expectedState = __assign(__assign({}, state), { propB: 'Changed' });
        var reducer = function () { return expectedState; };
        var onChange = jest.fn();
        var result = renderHook(function () { return useStatelessReducer(onChange, state, reducer); }).result;
        result.current(action);
        expect(onChange).toHaveBeenLastCalledWith(expectedState);
    });
});
describe('useDispatch Hook', function () {
    it('Should throw when used outside of DispatchContext', function () {
        var result = renderHook(function () { return useDispatch(); }).result;
        expect(result.error).toBeTruthy();
    });
    it('Should return a dispatch function', function () {
        var dispatch = jest.fn();
        var wrapper = function (_a) {
            var children = _a.children;
            return (React.createElement(DispatchContext.Provider, { value: dispatch }, children));
        };
        var result = renderHook(function () { return useDispatch(); }, {
            wrapper: wrapper,
        }).result;
        expect(result.current).toBe(dispatch);
    });
});
describe('combineReducers', function () {
    it('Should correctly combine reducers', function () {
        var reducerA = jest.fn();
        var reducerB = jest.fn();
        var combinedReducer = combineReducers({ reducerA: reducerA, reducerB: reducerB });
        var action = { type: 'SOME ACTION' };
        var initialState = { reducerA: 'A', reducerB: 'B' };
        combinedReducer(initialState, action);
        expect(reducerA).toHaveBeenCalledWith(initialState.reducerA, action);
        expect(reducerB).toHaveBeenCalledWith(initialState.reducerB, action);
    });
});
//# sourceMappingURL=useStatelessReducer.test.js.map
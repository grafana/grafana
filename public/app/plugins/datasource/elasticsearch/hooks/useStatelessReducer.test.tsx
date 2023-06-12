import { renderHook } from '@testing-library/react-hooks';
import React, { PropsWithChildren } from 'react';

import { useStatelessReducer, useDispatch, DispatchContext, combineReducers } from './useStatelessReducer';

describe('useStatelessReducer Hook', () => {
  it('When dispatch is called, it should call the provided reducer with the correct action and state', () => {
    const action = { type: 'SOME ACTION' };
    const reducer = jest.fn();
    const state = { someProp: 'some state' };

    const { result } = renderHook(() => useStatelessReducer(() => {}, state, reducer));

    result.current(action);

    expect(reducer).toHaveBeenCalledWith(state, action);
  });

  it('When an action is dispatched, it should call the provided onChange callback with the result from the reducer', () => {
    const action = { type: 'SOME ACTION' };
    const state = { propA: 'A', propB: 'B' };
    const expectedState = { ...state, propB: 'Changed' };
    const reducer = () => expectedState;
    const onChange = jest.fn();

    const { result } = renderHook(() => useStatelessReducer(onChange, state, reducer));

    result.current(action);

    expect(onChange).toHaveBeenLastCalledWith(expectedState);
  });
});

describe('useDispatch Hook', () => {
  it('Should throw when used outside of DispatchContext', () => {
    const { result } = renderHook(() => useDispatch());

    expect(result.error).toBeTruthy();
  });

  it('Should return a dispatch function', () => {
    const dispatch = jest.fn();
    const wrapper = ({ children }: PropsWithChildren<{}>) => (
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    );

    const { result } = renderHook(() => useDispatch(), {
      wrapper,
    });

    expect(result.current).toBe(dispatch);
  });
});

describe('combineReducers', () => {
  it('Should correctly combine reducers', () => {
    const reducerA = jest.fn();
    const reducerB = jest.fn();

    const combinedReducer = combineReducers({ reducerA, reducerB });

    const action = { type: 'SOME ACTION' };
    const initialState = { reducerA: 'A', reducerB: 'B' };

    combinedReducer(initialState, action);

    expect(reducerA).toHaveBeenCalledWith(initialState.reducerA, action);
    expect(reducerB).toHaveBeenCalledWith(initialState.reducerB, action);
  });
});

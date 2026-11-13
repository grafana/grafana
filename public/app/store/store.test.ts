import { configureStore } from '@reduxjs/toolkit';

import { initialKeyedVariablesState } from 'app/features/variables/state/initialKeyedVariablesState';

import { dispatch, getState, setStore, store } from './store';

const originalStore = store;

afterEach(() => {
  setStore(originalStore);
  jest.restoreAllMocks();
});

describe('getState', () => {
  it('returns a shallow copy of the shared fallback state before store initialization', () => {
    const firstState = getState();
    const secondState = getState();

    expect(firstState).toEqual({ templating: { keys: {}, lastKey: 'key' } });
    expect(firstState.templating).not.toBe(secondState.templating);
    expect(firstState.templating.keys).toBe(initialKeyedVariablesState.keys);
    expect(initialKeyedVariablesState).toEqual({ keys: {} });
  });

  it('returns the state from the configured store without copying it', () => {
    const state = { ...getState(), templating: { keys: {}, lastKey: 'dashboard' } };
    const configuredStore = configureStore({ reducer: () => state });
    setStore(configuredStore);

    expect(getState()).toBe(state);
  });
});

describe('dispatch', () => {
  it('leaves the fallback state unchanged before store initialization', () => {
    expect(dispatch({ type: 'test/action' })).toBeUndefined();
    expect(getState()).toEqual({ templating: { keys: {}, lastKey: 'key' } });
  });

  it('forwards the action to the configured store and returns its result', () => {
    const state = getState();
    const configuredStore = configureStore({ reducer: () => state });
    const dispatchSpy = jest.spyOn(configuredStore, 'dispatch');
    setStore(configuredStore);
    const action = { type: 'test/action', payload: 'value' };

    expect(dispatch(action)).toBe(action);
    expect(dispatchSpy).toHaveBeenCalledWith(action);
  });
});

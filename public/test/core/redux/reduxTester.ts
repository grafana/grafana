import { AnyAction, configureStore, EnhancedStore, Reducer } from '@reduxjs/toolkit';
import { Dispatch, Middleware, MiddlewareAPI } from 'redux';

import { StoreState } from '../../../app/types';
import thunk from 'redux-thunk';
import { setStore } from '../../../app/store/store';

export interface ReduxTesterGiven<State> {
  givenRootReducer: (rootReducer: Reducer<State>) => ReduxTesterWhen<State>;
}

export interface ReduxTesterWhen<State> {
  whenActionIsDispatched: (
    action: any,
    clearPreviousActions?: boolean
  ) => ReduxTesterWhen<State> & ReduxTesterThen<State>;
  whenAsyncActionIsDispatched: (
    action: any,
    clearPreviousActions?: boolean
  ) => Promise<ReduxTesterWhen<State> & ReduxTesterThen<State>>;
}

export interface ReduxTesterThen<State> {
  thenDispatchedActionShouldEqual: (...dispatchedAction: AnyAction[]) => ReduxTesterWhen<State>;
  thenDispatchedActionPredicateShouldEqual: (
    predicate: (dispatchedActions: AnyAction[]) => boolean
  ) => ReduxTesterWhen<State>;
}

export interface ReduxTesterArguments<State> {
  preloadedState?: State;
  debug?: boolean;
}

export const reduxTester = <State>(args?: ReduxTesterArguments<State>): ReduxTesterGiven<State> => {
  const dispatchedActions: AnyAction[] = [];
  const logActionsMiddleWare: Middleware<{}, Partial<StoreState>> = (
    store: MiddlewareAPI<Dispatch, Partial<StoreState>>
  ) => (next: Dispatch) => (action: AnyAction) => {
    // filter out thunk actions
    if (action && typeof action !== 'function') {
      dispatchedActions.push(action);
    }

    return next(action);
  };

  const preloadedState = args?.preloadedState ?? (({} as unknown) as State);
  const debug = args?.debug ?? false;
  let store: EnhancedStore<State> | null = null;

  const givenRootReducer = (rootReducer: Reducer<State>): ReduxTesterWhen<State> => {
    store = configureStore<State>({
      reducer: rootReducer,
      middleware: [logActionsMiddleWare, thunk],
      preloadedState,
    });
    setStore(store as any);

    return instance;
  };

  const whenActionIsDispatched = (
    action: any,
    clearPreviousActions?: boolean
  ): ReduxTesterWhen<State> & ReduxTesterThen<State> => {
    if (clearPreviousActions) {
      dispatchedActions.length = 0;
    }
    store.dispatch(action);

    return instance;
  };

  const whenAsyncActionIsDispatched = async (
    action: any,
    clearPreviousActions?: boolean
  ): Promise<ReduxTesterWhen<State> & ReduxTesterThen<State>> => {
    if (clearPreviousActions) {
      dispatchedActions.length = 0;
    }

    await store.dispatch(action);

    return instance;
  };

  const thenDispatchedActionShouldEqual = (...actions: AnyAction[]): ReduxTesterWhen<State> => {
    if (debug) {
      console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
    }

    if (!actions.length) {
      throw new Error('thenDispatchedActionShouldEqual has to be called with at least one action');
    }

    expect(dispatchedActions).toEqual(actions);
    return instance;
  };

  const thenDispatchedActionPredicateShouldEqual = (
    predicate: (dispatchedActions: AnyAction[]) => boolean
  ): ReduxTesterWhen<State> => {
    if (debug) {
      console.log('Dispatched Actions', JSON.stringify(dispatchedActions, null, 2));
    }

    expect(predicate(dispatchedActions)).toBe(true);
    return instance;
  };

  const instance = {
    givenRootReducer,
    whenActionIsDispatched,
    whenAsyncActionIsDispatched,
    thenDispatchedActionShouldEqual,
    thenDispatchedActionPredicateShouldEqual,
  };

  return instance;
};

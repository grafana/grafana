import { AnyAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';
import { Action } from 'redux';

import { StoreState } from 'app/types/store';

type GrafanaReducer<S = StoreState, A extends Action = AnyAction> = (state: S, action: A) => S;

export interface Given<State> {
  givenReducer: (
    reducer: GrafanaReducer<State, AnyAction>,
    state: State,
    showDebugOutput?: boolean,
    disableDeepFreeze?: boolean
  ) => When<State>;
}

export interface When<State> {
  whenActionIsDispatched: (action: AnyAction) => Then<State>;
}

export interface Then<State> {
  thenStateShouldEqual: (state: State) => When<State>;
  thenStatePredicateShouldEqual: (predicate: (resultingState: State) => boolean) => When<State>;
  whenActionIsDispatched: (action: AnyAction) => Then<State>;
}

const isNotException = (object: unknown, propertyName: string) =>
  typeof object === 'function'
    ? propertyName !== 'caller' && propertyName !== 'callee' && propertyName !== 'arguments'
    : true;

export const deepFreeze = <T>(obj: T): T => {
  if (typeof obj === 'object') {
    for (const key in obj) {
      const prop = obj[key];

      if (
        prop &&
        Object.hasOwn(obj, key) &&
        isNotException(obj, key) &&
        (typeof prop === 'object' || typeof prop === 'function') &&
        !Object.isFrozen(prop)
      ) {
        deepFreeze(prop);
      }
    }
  }

  return Object.freeze(obj);
};

interface ReducerTester<State> extends Given<State>, When<State>, Then<State> {}

export const reducerTester = <State>(): Given<State> => {
  let reducerUnderTest: GrafanaReducer<State, AnyAction>;
  let resultingState: State;
  let initialState: State;
  let showDebugOutput = false;

  const givenReducer = (
    reducer: GrafanaReducer<State, AnyAction>,
    state: State,
    debug = false,
    disableDeepFreeze = false
  ): When<State> => {
    reducerUnderTest = reducer;
    initialState = cloneDeep(state);
    if (!disableDeepFreeze && (typeof state === 'object' || typeof state === 'function')) {
      deepFreeze(initialState);
    }
    showDebugOutput = debug;

    return instance;
  };

  const whenActionIsDispatched = (action: AnyAction): Then<State> => {
    resultingState = reducerUnderTest(resultingState || initialState, action);

    return instance;
  };

  const thenStateShouldEqual = (state: State): When<State> => {
    if (showDebugOutput) {
      console.log(JSON.stringify(resultingState, null, 2));
    }
    expect(resultingState).toEqual(state);

    return instance;
  };

  const thenStatePredicateShouldEqual = (predicate: (resultingState: State) => boolean): When<State> => {
    if (showDebugOutput) {
      console.log(JSON.stringify(resultingState, null, 2));
    }
    expect(predicate(resultingState)).toBe(true);

    return instance;
  };

  const instance: ReducerTester<State> = {
    thenStateShouldEqual,
    thenStatePredicateShouldEqual,
    givenReducer,
    whenActionIsDispatched,
  };

  return instance;
};

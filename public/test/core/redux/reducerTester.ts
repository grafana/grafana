import { Reducer } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';

export interface Given<State> {
  givenReducer: (
    reducer: Reducer<State, PayloadAction<any>>,
    state: State,
    showDebugOutput?: boolean,
    disableDeepFreeze?: boolean
  ) => When<State>;
}

export interface When<State> {
  whenActionIsDispatched: (action: PayloadAction<any>) => Then<State>;
}

export interface Then<State> {
  thenStateShouldEqual: (state: State) => When<State>;
  thenStatePredicateShouldEqual: (predicate: (resultingState: State) => boolean) => When<State>;
}

interface ObjectType extends Object {
  [key: string]: any;
}

export const deepFreeze = <T>(obj: T): T => {
  Object.freeze(obj);

  const isNotException = (object: any, propertyName: any) =>
    typeof object === 'function'
      ? propertyName !== 'caller' && propertyName !== 'callee' && propertyName !== 'arguments'
      : true;
  const hasOwnProp = Object.prototype.hasOwnProperty;

  if (obj && obj instanceof Object) {
    const object: ObjectType = obj;
    Object.getOwnPropertyNames(object).forEach(propertyName => {
      const objectProperty: any = object[propertyName];
      if (
        hasOwnProp.call(object, propertyName) &&
        isNotException(object, propertyName) &&
        objectProperty &&
        (typeof objectProperty === 'object' || typeof objectProperty === 'function') &&
        Object.isFrozen(objectProperty) === false
      ) {
        deepFreeze(objectProperty);
      }
    });
  }

  return obj;
};

interface ReducerTester<State> extends Given<State>, When<State>, Then<State> {}

export const reducerTester = <State>(): Given<State> => {
  let reducerUnderTest: Reducer<State, PayloadAction<any>>;
  let resultingState: State;
  let initialState: State;
  let showDebugOutput = false;

  const givenReducer = (
    reducer: Reducer<State, PayloadAction<any>>,
    state: State,
    debug = false,
    disableDeepFreeze = false
  ): When<State> => {
    reducerUnderTest = reducer;
    initialState = { ...state };
    if (!disableDeepFreeze) {
      initialState = deepFreeze(initialState);
    }
    showDebugOutput = debug;

    return instance;
  };

  const whenActionIsDispatched = (action: PayloadAction<any>): Then<State> => {
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

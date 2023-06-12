import { Action } from '@reduxjs/toolkit';
import { createContext, useCallback, useContext } from 'react';

export type Reducer<S, A extends Action> = (state: S, action: A) => S;

export const combineReducers =
  <S, A extends Action = Action>(reducers: { [P in keyof S]: Reducer<S[P], A> }) =>
  (state: S, action: A): Partial<S> => {
    const newState = {} as S;
    for (const key in reducers) {
      newState[key] = reducers[key](state[key], action);
    }
    return newState;
  };

export const useStatelessReducer = <State, A = Action>(
  onChange: (value: State) => void,
  state: State,
  reducer: (state: State, action: A) => State
) => {
  const dispatch = useCallback(
    (action: A) => {
      onChange(reducer(state, action));
    },
    [onChange, state, reducer]
  );

  return dispatch;
};

export const DispatchContext = createContext<((action: Action) => void) | undefined>(undefined);

export const useDispatch = <T extends Action = Action>(): ((action: T) => void) => {
  const dispatch = useContext(DispatchContext);

  if (!dispatch) {
    throw new Error('Use DispatchContext first.');
  }

  return dispatch;
};

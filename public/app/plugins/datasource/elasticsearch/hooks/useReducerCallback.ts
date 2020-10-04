import { useCallback } from 'react';

export interface Action<T extends string = string> {
  type: T;
}
export type Reducer<S, A extends Action = Action> = (state: S, action: A) => S;

export const combineReducers = <S, A extends Action = Action>(reducers: { [P in keyof S]: Reducer<S[P], A> }) => (
  state: S,
  action: A
): Partial<S> => {
  const newState = {} as S;
  for (const key in reducers) {
    newState[key] = reducers[key](state[key], action);
  }
  return newState;
};

export const useReducerCallback = <State, A = Action>(
  onChange: (value: State) => void,
  state: State,
  reducer: (state: State, action: A) => State
) => {
  const dispatch = useCallback(
    (action: A) => {
      const newState = reducer(state, action);
      onChange({ ...state, ...newState });
    },
    [onChange]
  );

  return dispatch;
};

import { Reducer } from 'redux';
import { ActionOf } from './actionCreatorFactory';
import { locationChanged, LocationChanged } from '../actions/location';

export const resetStateForPath = <State>(reducer: Reducer<State, ActionOf<any>>, resetStateForPath: string) => (
  state: State,
  action: ActionOf<any>
): State => {
  if (action.type === locationChanged.type) {
    const { fromPath, toPath } = action.payload as LocationChanged;
    if (resetStateForPath && resetStateForPath === fromPath && toPath.indexOf(fromPath) === -1) {
      state = undefined;
    }
  }

  return reducer(state, action);
};

import { VariablesState } from './types';

export function getInstanceState(state: VariablesState, id: string) {
  return state[id];
}

import { VariableState } from './types';

export type MutateStateFunc<S extends VariableState> = (state: S) => S;

export const applyStateChanges = <S extends VariableState>(state: S, ...args: Array<MutateStateFunc<S>>): S => {
  return args.reduce((all, cur) => {
    return cur(all);
  }, state);
};

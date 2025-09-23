export type MutateStateFunc<S> = (state: S) => S;

export const applyStateChanges = <S>(state: S, ...args: Array<MutateStateFunc<S>>): S => {
  return args.reduce((all, cur) => {
    return cur(all);
  }, state);
};

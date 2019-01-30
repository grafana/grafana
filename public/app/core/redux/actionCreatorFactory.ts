import { Action } from 'redux';

const allActionCreators: string[] = [];

export interface ActionOf<Payload> extends Action {
  readonly type: string;
  readonly payload: Payload;
}

export interface ActionCreator<Payload> {
  readonly type: string;
  (payload: Payload): ActionOf<Payload>;
}

export interface ActionCreatorFactory<Payload> {
  create: () => ActionCreator<Payload>;
}

export const actionCreatorFactory = <Payload>(type: string): ActionCreatorFactory<Payload> => {
  const create = (): ActionCreator<Payload> => {
    return Object.assign((payload: Payload): ActionOf<Payload> => ({ type, payload }), { type });
  };

  if (allActionCreators.some(t => (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false))) {
    throw new Error(`There is already an actionCreator defined with the type ${type}`);
  }

  allActionCreators.push(type);

  return { create };
};

// Should only be used by tests
export const resetAllActionCreatorTypes = () => (allActionCreators.length = 0);

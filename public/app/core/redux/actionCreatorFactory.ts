import { Action } from 'redux';

const allActionCreators: string[] = [];

export interface GrafanaAction<Payload> extends Action {
  readonly type: string;
  readonly payload: Payload;
}

export interface GrafanaActionCreator<Payload> {
  readonly type: string;
  (payload: Payload): GrafanaAction<Payload>;
}

export interface ActionCreatorFactory<Payload> {
  create: () => GrafanaActionCreator<Payload>;
}

export const actionCreatorFactory = <Payload>(type: string): ActionCreatorFactory<Payload> => {
  const create = (): GrafanaActionCreator<Payload> => {
    return Object.assign((payload: Payload): GrafanaAction<Payload> => ({ type, payload }), { type });
  };

  if (allActionCreators.some(t => (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false))) {
    throw new Error(`There is already an actionCreator defined with the type ${type}`);
  }

  allActionCreators.push(type);

  return { create };
};

// Should only be used by tests
export const resetAllActionCreatorTypes = () => (allActionCreators.length = 0);

import { Action } from 'redux';

const allActionCreators: string[] = [];

export interface ActionOf<Payload> extends Action {
  readonly type: string;
  readonly id?: string; // used by higher order actions, always undefined for lower order actions
  readonly payload: Payload;
}

export interface ActionCreator<Payload> {
  readonly type: string;
  (payload: Payload): ActionOf<Payload>;
}

export interface HigherOrderActionCreator<Payload> {
  readonly type: string;
  (id: string): ActionCreator<Payload>;
}

export interface NoPayloadActionCreator {
  readonly type: string;
  (): ActionOf<undefined>;
}

export interface NoPayloadHigherOrderActionCreator {
  readonly type: string;
  (id: string): NoPayloadActionCreator;
}

export interface ActionCreatorFactory<Payload> {
  create: () => ActionCreator<Payload>;
}

export interface NoPayloadActionCreatorFactory {
  create: () => NoPayloadActionCreator;
}

export interface HigherOrderActionCreatorFactory<Payload> {
  create: () => HigherOrderActionCreator<Payload>;
}

export interface NoPayloadHigherOrderActionCreatorFactory {
  create: () => NoPayloadHigherOrderActionCreator;
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

export const noPayloadActionCreatorFactory = (type: string): NoPayloadActionCreatorFactory => {
  const create = (): NoPayloadActionCreator => {
    return Object.assign((): ActionOf<undefined> => ({ type, payload: undefined }), { type });
  };

  if (allActionCreators.some(t => (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false))) {
    throw new Error(`There is already an actionCreator defined with the type ${type}`);
  }

  allActionCreators.push(type);

  return { create };
};

export const higherOrderActionCreatorFactory = <Payload>(type: string): HigherOrderActionCreatorFactory<Payload> => {
  const create = (): HigherOrderActionCreator<Payload> => {
    return Object.assign(
      (id: string): ActionCreator<Payload> =>
        Object.assign((payload: Payload): ActionOf<Payload> => ({ type, payload, id }), { type, id }),
      { type }
    );
  };

  if (allActionCreators.some(t => (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false))) {
    throw new Error(`There is already an actionCreator defined with the type ${type}`);
  }

  allActionCreators.push(type);

  return { create };
};

export const noPayloadHigherOrderActionCreatorFactory = (type: string): NoPayloadHigherOrderActionCreatorFactory => {
  const create = (): NoPayloadHigherOrderActionCreator => {
    return Object.assign(
      (id: string): NoPayloadActionCreator =>
        Object.assign((): ActionOf<undefined> => ({ type, payload: undefined, id }), { type, id }),
      { type }
    );
  };

  if (allActionCreators.some(t => (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false))) {
    throw new Error(`There is already an actionCreator defined with the type ${type}`);
  }

  allActionCreators.push(type);

  return { create };
};

export interface NoPayloadActionCreatorMock extends NoPayloadActionCreator {
  calls: number;
}

export const getNoPayloadActionCreatorMock = (creator: NoPayloadActionCreator): NoPayloadActionCreatorMock => {
  const mock: NoPayloadActionCreatorMock = Object.assign(
    (): ActionOf<undefined> => {
      mock.calls++;
      return { type: creator.type, payload: undefined };
    },
    { type: creator.type, calls: 0 }
  );
  return mock;
};

// Should only be used by tests
export const resetAllActionCreatorTypes = () => (allActionCreators.length = 0);

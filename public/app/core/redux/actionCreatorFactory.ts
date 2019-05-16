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

export interface NoPayloadActionCreator {
  readonly type: string;
  (): ActionOf<undefined>;
}

export interface ActionCreatorFactory<Payload> {
  create: () => ActionCreator<Payload>;
}

export interface NoPayloadActionCreatorFactory {
  create: () => NoPayloadActionCreator;
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

export const mockActionCreator = (creator: ActionCreator<any>) => {
  return Object.assign(jest.fn(), creator);
};

// Should only be used by tests
export const resetAllActionCreatorTypes = () => (allActionCreators.length = 0);

import { Action } from 'redux';

const allActionCreators = new Set<string>();

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

export function actionCreatorFactory<Payload extends undefined>(type: string): NoPayloadActionCreatorFactory;
export function actionCreatorFactory<Payload>(type: string): ActionCreatorFactory<Payload>;
export function actionCreatorFactory<Payload>(type: string): ActionCreatorFactory<Payload> {
  const upperCaseType = type.toLocaleUpperCase();
  if (allActionCreators.has(upperCaseType)) {
    throw new Error(`An actionCreator with type '${type}' has already been defined.`);
  }

  allActionCreators.add(upperCaseType);

  const create = (): ActionCreator<Payload> => {
    return Object.assign((payload: Payload): ActionOf<Payload> => ({ type, payload }), { type });
  };
  return { create };
}

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
export const resetAllActionCreatorTypes = () => allActionCreators.clear();

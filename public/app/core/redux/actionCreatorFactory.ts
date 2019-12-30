import { Action } from 'redux';
import { ActionCreatorWithoutPayload, PayloadActionCreator } from '@reduxjs/toolkit';

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

export const mockToolkitActionCreator = (creator: PayloadActionCreator<any>) => {
  return Object.assign(jest.fn(), creator);
};

export type ToolkitActionCreatorWithoutPayloadMockType = typeof mockToolkitActionCreatorWithoutPayload &
  ActionCreatorWithoutPayload<any>;

export const mockToolkitActionCreatorWithoutPayload = (creator: ActionCreatorWithoutPayload<any>) => {
  return Object.assign(jest.fn(), creator);
};

// Should only be used by tests
export const resetAllActionCreatorTypes = () => allActionCreators.clear();

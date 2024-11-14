import { ActionCreatorWithoutPayload, PayloadActionCreator } from '@reduxjs/toolkit';

export const mockToolkitActionCreator = <P = void, T extends string = string>(creator: PayloadActionCreator<P, T>) => {
  return Object.assign(jest.fn(), creator);
};

export type ToolkitActionCreatorWithoutPayloadMockType = typeof mockToolkitActionCreatorWithoutPayload &
  ActionCreatorWithoutPayload;

export const mockToolkitActionCreatorWithoutPayload = (creator: ActionCreatorWithoutPayload) => {
  return Object.assign(jest.fn(), creator);
};

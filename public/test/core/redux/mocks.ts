import { ActionCreatorWithoutPayload, PayloadActionCreator } from '@reduxjs/toolkit';

export const mockToolkitActionCreator = <T extends string>(creator: PayloadActionCreator<any, T>) => {
  return Object.assign(jest.fn(), creator);
};

export type ToolkitActionCreatorWithoutPayloadMockType = typeof mockToolkitActionCreatorWithoutPayload &
  ActionCreatorWithoutPayload;

export const mockToolkitActionCreatorWithoutPayload = (creator: ActionCreatorWithoutPayload) => {
  return Object.assign(jest.fn(), creator);
};

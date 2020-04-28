import { ActionCreatorWithoutPayload, PayloadActionCreator } from '@reduxjs/toolkit';

export const mockToolkitActionCreator = (creator: PayloadActionCreator<any>) => {
  return Object.assign(jest.fn(), creator);
};

export type ToolkitActionCreatorWithoutPayloadMockType = typeof mockToolkitActionCreatorWithoutPayload &
  ActionCreatorWithoutPayload<any>;

export const mockToolkitActionCreatorWithoutPayload = (creator: ActionCreatorWithoutPayload<any>) => {
  return Object.assign(jest.fn(), creator);
};

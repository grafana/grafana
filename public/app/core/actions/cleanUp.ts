import { createAction } from '@reduxjs/toolkit';

// @todo: replace barrel import path
import { StoreState } from '../../types/index';

export type CleanUpAction = (state: StoreState) => void;

export interface CleanUpPayload {
  cleanupAction: CleanUpAction;
}

export const cleanUpAction = createAction<CleanUpPayload>('core/cleanUpState');

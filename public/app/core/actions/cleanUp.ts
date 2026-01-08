import { createAction } from '@reduxjs/toolkit';

import { StoreState } from 'app/types/store';

export type CleanUpAction = (state: StoreState) => void;

export interface CleanUpPayload {
  cleanupAction: CleanUpAction;
}

export const cleanUpAction = createAction<CleanUpPayload>('core/cleanUpState');

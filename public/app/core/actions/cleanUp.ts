import { createAction } from '@reduxjs/toolkit';

import { StoreState } from '../../types';

export type StateSelector<T> = (state: StoreState) => T;

export interface CleanUp<T> {
  stateSelector: (state: StoreState) => T;
}

export const cleanUpAction = createAction<CleanUp<{}>>('core/cleanUpState');

import { StoreState } from '../../types';
import { actionCreatorFactory } from '../redux';

export type StateSelector<T extends object> = (state: StoreState) => T;

export interface CleanUp<T extends object> {
  stateSelector: StateSelector<T>;
}

export const cleanUpAction = actionCreatorFactory<CleanUp<{}>>('CORE_CLEAN_UP_STATE').create();

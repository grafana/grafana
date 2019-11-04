import { StoreState } from '../types';
import { ActionOf } from '../core/redux';

export let store: {
  getState: () => StoreState;
  dispatch: (action: ActionOf<any>) => void;
  subscribe: (callback: () => void) => () => void;
};

export function setStore(newStore: any) {
  store = newStore;
}

import { Store } from 'redux';

import { StoreState } from '../types/store';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  if (!store || !store.getState) {
    return { defaultReducer: () => ({}), templating: { lastKey: 'key' } }; // used by tests
  }

  return store.getState();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dispatch(action: any) {
  if (!store || !store.getState) {
    return;
  }

  return store.dispatch(action);
}

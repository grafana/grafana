import { Store } from 'redux';

import { initialKeyedVariablesState } from 'app/features/variables/state/keyedVariablesReducer';
import { StoreState } from 'app/types/store';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  if (!store || !store.getState) {
    return { templating: { ...initialKeyedVariablesState, lastKey: 'key' } } as StoreState; // used by tests
  }

  return store.getState();
}

export function dispatch(action: any) {
  if (!store || !store.getState) {
    return;
  }

  return store.dispatch(action);
}

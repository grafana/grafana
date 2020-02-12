import { StoreState } from 'app/types';
import { Store } from 'redux';
import { initialState } from '../features/templating/state';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  if (!store) {
    return ({
      templating: initialState,
    } as any) as StoreState; // used by tests
  }

  return store.getState();
}

export function dispatch(action: any) {
  if (!store) {
    return;
  }

  return store.dispatch(action);
}

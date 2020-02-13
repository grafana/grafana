import { StoreState } from 'app/types';
import { Store } from 'redux';
import { initialTemplatingState } from '../features/templating/state';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  if (!store || !store.getState) {
    return ({
      templating: initialTemplatingState,
    } as any) as StoreState; // used by tests
  }

  return store.getState();
}

export function dispatch(action: any) {
  if (!store || !store.getState) {
    return;
  }

  return store.dispatch(action);
}

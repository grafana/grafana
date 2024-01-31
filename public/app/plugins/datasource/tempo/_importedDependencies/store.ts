import { Store } from 'redux';

export let store: Store<StoreState>;
export const initialKeyedVariablesState: any = { keys: {} };

type StoreState = ReturnType<ReturnType<any>>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  if (!store || !store.getState) {
    return { templating: { ...initialKeyedVariablesState, lastKey: 'key' } } as StoreState; // used by tests
  }

  return store.getState();
}

// This was `any` before
export function dispatch(action: any) {
  if (!store || !store.getState) {
    return;
  }

  return store.dispatch(action);
}

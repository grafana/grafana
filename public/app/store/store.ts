import { StoreState } from 'app/types';
import { Store } from 'redux';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

import { ActionOf } from 'app/core/redux';
import { StoreState } from 'app/types';
import { Store } from 'redux';

export let store: Store<StoreState, ActionOf<any>>;

export function setStore(newStore: Store<StoreState, ActionOf<any>>) {
  store = newStore;
}

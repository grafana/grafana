import { RootStore, RootStoreInterface } from './RootStore/RootStore';
import config from 'app/core/config';

export let store: RootStoreInterface;

export function createStore(services) {
  store = RootStore.create(
    {},
    {
      ...services,
      navTree: config.bootData.navTree,
    }
  );

  return store;
}

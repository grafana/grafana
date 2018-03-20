import { RootStore, IRootStore } from './RootStore/RootStore';
import config from 'app/core/config';

export let store: IRootStore;

export function createStore(backendSrv) {
  store = RootStore.create(
    {},
    {
      backendSrv: backendSrv,
      navTree: config.bootData.navTree,
    }
  );

  return store;
}

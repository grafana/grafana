import { RootStore, IRootStore } from './RootStore';

export let store: IRootStore;

export function createStore(backendSrv) {
  store = RootStore.create(
    {},
    {
      backendSrv: backendSrv,
    }
  );
}

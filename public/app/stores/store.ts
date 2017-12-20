import { RootStore, IRootStore } from "./RootStore";

export let store: IRootStore;

export function createStore() {
  store = RootStore.create({});
}

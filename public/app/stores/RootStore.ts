import { types } from "mobx-state-tree";
import { SearchStore } from "./SearchStore";

export const RootStore = types.model({
  search: types.optional(SearchStore, {
    sections: []
  })
});

type IRootStoreType = typeof RootStore.Type;
export interface IRootStore extends IRootStoreType {}
